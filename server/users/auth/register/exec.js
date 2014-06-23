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


  // Check recaptcha
  //
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


  // Get id of 'validating' group
  //
  N.wire.before(apiPath, function find_validating_group_id(env, callback) {
    N.models.users.UserGroup.findIdByName('validating', function(err, id) {
      env.data.validatingGroupId = id;
      callback(err);
    });
  });


  // Get id of group to move after registration
  //
  N.wire.before(apiPath, function find_after_register_group_id(env, callback) {
    N.settings.get('register_user_validated_group', function (err, id) {
      env.data.validatedGroupId = id;
      callback(err);
    });
  });


  // Create user record
  //
  N.wire.on(apiPath, function create_user(env, callback) {
    env.res.head.title = env.t('title');

    if (!_.isEmpty(env.data.errors)) {
      callback({ code: N.io.CLIENT_ERROR, data: env.data.errors });
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
      user.usergroups = [ env.data.validatedGroupId ];
      user.joined_ip  = env.req.ip;
      user.joined_ts  = new Date();
      user.locale     = env.runtime.locale || N.config.locales['default'];

      user.save(function (err, user) {
        if (err) {
          callback(err);
          return;
        }

        env.data.user = user;
        callback();
      });
    });
  });


  // Add auth provider record
  //
  N.wire.after(apiPath, function create_user_privider(env, callback) {

    var user = env.data.user;

    var authlink = new N.models.users.AuthLink({ 'user_id': user._id });

    var provider = authlink.providers.create({
      type: 'plain',
      email: env.params.email
    });

    function fail(err) {
      user.remove(function () {
        callback(err);
      });
    }

    provider.setPass(env.params.pass, function (err) {
      if (err) {
        // Can't fill hash - delete the user.
        // Should not happen in real life
        fail(err);
        return;
      }

      authlink.providers.push(provider);
      authlink.save(function (err) {
        if (err) {
          // Can't create authlink - delete the user.
          // Should not happen in real life
          fail(err);
          return;
        }

        env.data.provider = provider;

        callback();
      });
    });
  });


  // Auto login to the new account.
  //
  N.wire.after(apiPath, function autologin(env, callback) {

    var user = env.data.user;
    var provider =  env.data.provider;


    N.wire.emit('internal:users.login', env, function (err) {
      if (err) {
        callback(err);
        return;
      }

      // If the user is in 'validating' group according to global settings,
      // send activation token by email.
      if (env.data.validatingGroupId.equals(env.data.validatedGroupId)) {
        env.res.redirect_url = N.runtime.router.linkTo('users.auth.register.done_show');

        N.models.users.TokenActivationEmail.create({ user_id: user._id }, function (err, token) {
          if (err) {
            callback(err);
            return;
          }

          sendActivationEmail(N, env, provider.email, token, callback);
        });
        return;
      }

      env.res.redirect_url = N.runtime.router.linkTo('users.profile');
      callback();
    });
  });
};
