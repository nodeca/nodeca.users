// Register a new user.


'use strict';


var _           = require('lodash');
var revalidator = require('revalidator');
var recaptcha   = require('nodeca.core/lib/recaptcha.js');

var sendActivationToken = require('./_lib/send_activation_token');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    email: { type: 'string', required: true }
  , pass:  { type: 'string', required: true }
  , nick:  { type: 'string', required: true }
  , recaptcha_challenge_field: { type: 'string' }
  , recaptcha_response_field:  { type: 'string' }
  });


  N.wire.before(apiPath, function find_validating_group_id(env, callback) {
    N.models.users.UserGroup.findIdByName('validating', function(err, id) {
      env.data.validatingGroupId = id;
      callback(err);
    });
  });


  N.wire.before(apiPath, function prepare_env_data(env) {
    env.data.errors = {};
  });


  N.wire.on(apiPath, function validate_params(env) {
    var report = revalidator.validate(env.params, {
      type: 'object'
    , properties: {
        email: { format: 'email'                               }
      , pass:  { conform: N.models.users.User.validatePassword }
      , nick:  { conform: N.models.users.User.validateNick     }
      }
    });

    if (!report.valid) {
      _.forEach(report.errors, function (error) {
        // Don't customize form text, just highlight the field.
        env.data.errors[error.property] = null;
      });
    }
  });


  N.wire.on(apiPath, function check_email_uniqueness(env, callback) {
    N.models.users.AuthLink
        .findOne({ 'providers.email': env.params.email })
        .select('_id')
        .setOptions({ lean: true })
        .exec(function (err, authlink) {

      if (err) {
        callback(err);
        return;
      }

      if (authlink) {
        env.data.errors.email = env.helpers.t('users.auth.register.message_busy_email');
      }

      callback();
    });
  });


  N.wire.on(apiPath, function check_nick_uniqueness(env, callback) {
    N.models.users.User
        .findOne({ 'nick': env.params.nick })
        .select('_id')
        .setOptions({ lean: true })
        .exec(function (err, user) {

      if (err) {
        callback(err);
        return;
      }

      if (user) {
        env.data.errors.nick = env.helpers.t('users.auth.register.message_busy_nick');
      }

      callback();
    });
  });


  N.wire.on(apiPath, function validate_recaptcha(env, callback) {
    if (!_.isEmpty(env.data.errors)) {
      // Skip if some other fields are incorrect in order to not change
      // captcha words and not annoy the user by forcing him to retype.
      callback();
      return;
    }

    var privateKey = N.config.options.recaptcha.private_key
      , clientIp   = env.request.ip
      , challenge  = env.params.recaptcha_challenge_field
      , response   = env.params.recaptcha_response_field;

    recaptcha.verify(privateKey, clientIp, challenge, response, function (err, result) {
      // User send wrong captcha code.
      // Don't customize form text, just highlight the field.
      if (err || !result) {
        env.data.errors.recaptcha_response_field = null;
      }

      callback();
    });
  });


  N.wire.on(apiPath, function register(env, callback) {
    env.response.data.head.title = env.helpers.t('users.auth.register.title');

    if (!_.isEmpty(env.data.errors)) {
      callback({ code: N.io.CLIENT_ERROR, data: env.data.errors });
      return;
    }

    N.settings.get('register_user_initial_group', {}, function (err, groupId) {
      if (err) {
        callback(err);
        return;
      }

      var user = new N.models.users.User();

      user.nick       = env.params.nick;
      user.usergroups = [ groupId ];
      user.joined_ip  = env.request.ip;
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
        provider.setPass(env.params.pass);

        authlink.providers.push(provider);
        authlink.save(function (err) {
          if (err) {
            user.remove(callback); // Can't create authlink - delete the user.
            return;
          }

          // Auto log-in to the new account.
          env.session.user_id = user._id;

          // If the user is in 'validating' group according to global settings, 
          // send activation token by email.
          if (env.data.validatingGroupId.equals(groupId)) {
            env.response.data.redirect_url = N.runtime.router.linkTo('users.auth.register.done');
            sendActivationToken(N, env, provider.email, callback);
          } else {
            env.response.data.redirect_url = N.runtime.router.linkTo('users.profile');
            callback();
          }
        });
      });
    });
  });
};
