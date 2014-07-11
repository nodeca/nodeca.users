// Register a new user. If email validation needed store
// reg info in TokenActivationEmail. Else save user
//


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


  // Check email uniqueness. User email and oauth provider email should be unique
  //
  N.wire.before(apiPath, function check_email_uniqueness(env, callback) {

    var emails = [ env.params.email ];
    if (env.session.oauth) {
      emails.push(env.session.oauth.email);
    }

    N.models.users.AuthLink
        .findOne({ 'exist': true })
        .where('email').in(emails)
        .select('_id')
        .lean(true)
        .exec(function (err, authlink) {

      if (err) {
        callback(err);
        return;
      }

      if (authlink) {
        env.data.errors.email = env.t('err_busy_email');
      }

      callback();
    });
  });


  // Check nick uniqueness
  //
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
        env.data.errors.nick = env.t('err_busy_nick');
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
        env.data.errors.recaptcha_response_field = env.t('err_wrong_captcha_solution');
      }

      callback();
    });
  });


  // If previos checks failed terminate with client error
  //
  N.wire.before(apiPath, function check_errors(env, callback) {
    if (!_.isEmpty(env.data.errors)) {
      callback({ code: N.io.CLIENT_ERROR, data: env.data.errors });
      return;
    }
    callback();
  });


  // Check if need email validation step or should create user directly
  //
  N.wire.before(apiPath, function check_need_validation(env, callback) {
    N.settings.get('validate_email', function (err, validate_email) {

      if (err) {
        callback(err);
      }

      env.data.validate_email = validate_email;

      if (validate_email) {
        callback();
        return;
      }

      // If there is information about oauth provider then check trusted setting
      if (!env.session.oauth) {
        callback();
        return;
      }

      env.data.validate_email = !N.config.oauth[env.session.oauth.type].trusted;

      callback();
    });
  });


  // Create user record and login
  //
  function create_user(env, callback) {
    env.res.head.title = env.t('title');

    N.wire.emit('internal:users.user_create', env, function (err) {
      if (err) {
        callback(err);
        return;
      }

      N.wire.emit('internal:users.login', env, function (err) {
        if (err) {
          callback(err);
          return;
        }

        env.res.redirect_url = env.data.redirect_url;
        callback();
      });
    });
  }


  // If the user need to activate email, send activation token by email.
  //
  function send_activation(env, callback) {

    env.res.redirect_url = N.runtime.router.linkTo('users.auth.register.activate_show');

    N.models.users.TokenActivationEmail.create({
      ip: env.req.ip,
      reg_info: env.data.reg_info,
      oauth_info: env.data.oauth_info
    }, function (err, token) {
      if (err) {
        callback(err);
      }

      sendActivationEmail(N, env, env.data.reg_info.email, token, callback);
    });
  }


  // If the user need to activate email, create token.
  // Else save user
  //
  N.wire.on(apiPath, function finish_registration(env, callback) {

    env.data.reg_info = {
      nick: env.params.nick,
      email: env.params.email,
      pass: env.params.pass
    };

    env.data.oauth_info = env.session.oauth;
    env.session = _.omit(env.session, [ 'state', 'oauth' ]);

    if (env.data.validate_email) {
      send_activation(env, callback);
      return;
    }

    create_user(env, callback);
  });

};
