// Register a new user.


'use strict';


var _           = require('lodash');
var revalidator = require('revalidator');
var recaptcha   = require('nodeca.core/lib/recaptcha.js');

var sendActivationEmail = require('./_lib/send_activation_email');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    // `required` specially set to false, because values are checked later
    // to show errors in regustration form.
    email: { type: 'string', required: false }
  , pass:  { type: 'string', required: false }
  , nick:  { type: 'string', required: false }
  , recaptcha_challenge_field: { type: 'string', required: false }
  , recaptcha_response_field:  { type: 'string', required: false }
  });


  N.wire.before(apiPath, function register_guest_only(env, callback) {
    N.wire.emit('internal:users.redirect_not_guest', env, callback);
  });


  N.wire.before(apiPath, function prepare_env_data(env) {
    env.data.errors = env.data.errors || {};
  });


  N.wire.before(apiPath, function validate_params(env) {
    var report = revalidator.validate(env.params, {
      type: 'object'
    , properties: {
        email: { format: 'email',                               required: true }
      , pass:  { conform: N.models.users.User.validatePassword, required: true }
      , nick:  { conform: N.models.users.User.validateNick,     required: true }
      }
    });

    if (!report.valid) {
      _.forEach(report.errors, function (error) {
        // Don't customize form text, just highlight the field.
        env.data.errors[error.property] = null;
      });

      // terminate
      return { code: N.io.CLIENT_ERROR, data: env.data.errors };
    }
  });


  N.wire.before(apiPath, function check_email_uniqueness(env, callback) {
    N.models.users.AuthLink
        .findOne({ 'providers.email': env.params.email, 'providers.type': 'plain' })
        .select('_id')
        .lean(true)
        .exec(function (err, authlink) {

      if (err) {
        callback(err);
        return;
      }

      if (authlink) {
        env.data.errors.email = env.t('message_busy_email');
      }

      callback();
    });
  });


  N.wire.before(apiPath, function check_nick_uniqueness(env, callback) {
    N.models.users.User
        .findOne({ 'nick': env.params.nick })
        .select('_id')
        .lean(true)
        .exec(function (err, user) {

      if (err) {
        callback(err);
        return;
      }

      if (user) {
        env.data.errors.nick = env.t('message_busy_nick');
      }

      callback();
    });
  });


  N.wire.before(apiPath, function validate_recaptcha(env, callback) {
    if (!_.isEmpty(env.data.errors)) {
      // Skip if some other fields are incorrect in order to not change
      // captcha words and not annoy the user by forcing him to retype.
      callback();
      return;
    }

    var privateKey = N.config.options.recaptcha.private_key
      , clientIp   = env.req.ip
      , challenge  = env.params.recaptcha_challenge_field
      , response   = env.params.recaptcha_response_field;

    recaptcha.verify(privateKey, clientIp, challenge, response, function (err, result) {
      if (err || !result) {
        env.data.errors.recaptcha_response_field = env.t('message_wrong_captcha_solution');
      }

      callback();
    });
  });


  N.wire.before(apiPath, function find_validating_group_id(env, callback) {
    N.models.users.UserGroup.findIdByName('validating', function(err, id) {
      env.data.validatingGroupId = id;
      callback(err);
    });
  });


  N.wire.on(apiPath, function register(env, callback) {
    env.res.head.title = env.t('title');

    if (!_.isEmpty(env.data.errors)) {
      callback({ code: N.io.CLIENT_ERROR, data: env.data.errors });
      return;
    }

    N.settings.get('register_user_initial_group', function (err, groupId) {
      if (err) {
        callback(err);
        return;
      }

      // Find highest user hid. (plain number)
      N.models.core.Increment.next('user', function (err, newUserHid) {
        if (err) {
          callback(err);
          return;
        }

        var user = new N.models.users.User();

        user.hid         = newUserHid;
        user.nick       = env.params.nick;
        user.usergroups = [ groupId ];
        user.joined_ip  = env.req.ip;
        user.joined_ts  = new Date();
        user.locale     = env.runtime.locale || N.config.locales['default'];

        user.save(function (err, user) {
          if (err) {
            callback(err);
            return;
          }

          var authlink, provider;

          authlink = new N.models.users.AuthLink({ 'user_id': user._id });

          provider = authlink.providers.create({
            type: 'plain'
          , email: env.params.email
          });

          provider.setPass(env.params.pass, function (err) {
            if (err) {
              user.remove(callback); // Can't fill hash - delete the user.
              return;
            }

            authlink.providers.push(provider);
            authlink.save(function (err) {
              if (err) {
                user.remove(callback); // Can't create authlink - delete the user.
                return;
              }

              // Auto log-in to the new account.
              env.data.user = user;
              N.wire.emit('internal:users.login', env, function (err) {
                if (err) {
                  callback(err);
                  return;
                }

                // If the user is in 'validating' group according to global settings,
                // send activation token by email.
                if (env.data.validatingGroupId.equals(groupId)) {
                  env.res.redirect_url = N.runtime.router.linkTo('users.auth.register.done_show');

                  N.models.users.TokenActivationEmail.create({ user_id: user._id }, function (err, token) {
                    if (err) {
                      callback(err);
                      return;
                    }

                    sendActivationEmail(N, env, provider.email, token, callback);
                    return;
                  });
                } else {
                  env.res.redirect_url = N.runtime.router.linkTo('users.profile');
                  callback();
                  return;
                }
              });
            });
          });
        });
      });
    });
  });
};
