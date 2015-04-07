// Do login by `plain` provider (email/password or nick/password)


'use strict';


var _         = require('lodash');
var recaptcha = require('nodeca.core/lib/recaptcha');


module.exports = function (N, apiPath) {
  var rateLimit = require('./_rate_limit')(N);


  // Don't set "required" flag, to manually check data &
  // fill form errors
  //
  N.validate(apiPath, {
    email_or_nick: { type: 'string' },
    pass:          { type: 'string' },
    recaptcha_challenge_field: { type: 'string' },
    recaptcha_response_field:  { type: 'string' },
    redirect_id: { format: 'mongo' }
  });


  // Touch rate limits in lazy style - do not wait for callbacks.
  //
  function updateRateLimits(clientIp) {
    rateLimit.ip.update(clientIp);
    rateLimit.total.update();
  }


  // Kick logged-in members
  //
  N.wire.before(apiPath, function login_guest_only(env, callback) {
    N.wire.emit('internal:users.redirect_not_guest', env, callback);
  });


  // If there is neither email_or_nick or pass - stop before database queries.
  //
  N.wire.before(apiPath, function check_params(env) {
    if (_.isEmpty(env.params.email_or_nick) ||
        _.isEmpty(env.params.pass)) {
      return {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_login_failed'),
        captcha: false
      };
    }
  });


  // Check for too many total logins (60 attempts / 60 seconds).
  // That can cause too hight CPU use in bcrypt.
  // Do soft limit - ask user to enter captcha to make sure he is not a bot.
  //
  N.wire.before(apiPath, function check_total_rate_limit(env, callback) {
    rateLimit.total.check(function (err, isExceeded) {
      if (err) {
        callback(err);
        return;
      }

      env.data.captcha_required = isExceeded;

      // If limit is not exceeded - skip captcha check.
      if (!env.data.captcha_required) {
        callback();
        return;
      }

      var privateKey = N.config.options.recaptcha.private_key,
          clientIp   = env.req.ip,
          challenge  = env.params.recaptcha_challenge_field,
          response   = env.params.recaptcha_response_field;

      if (!response) {
        updateRateLimits(clientIp);
        callback({
          code:    N.io.CLIENT_ERROR,
          message: env.t('err_captcha_empty'),
          captcha: env.data.captcha_required
        });
        return;
      }

      recaptcha.verify(privateKey, clientIp, challenge, response, function (err, valid) {
        if (err) {
          callback(new Error('Captcha service error'));
          return;
        }

        if (!valid) {
          updateRateLimits(clientIp);
          callback({
            code:    N.io.CLIENT_ERROR,
            message: env.t('err_captcha_wrong'),
            captcha: env.data.captcha_required
          });
          return;
        }

        callback();
      });
    });
  });


  // Check for too many invalid logins (5 attempts / 300 seconds) from single IP
  // Do hard limit - ask user to wait 5 minutes.
  //
  N.wire.before(apiPath, function check_ip_rate_limit(env, callback) {
    rateLimit.ip.check(env.req.ip, function (err, isExceeded) {
      if (err) {
        callback(err);
        return;
      }

      if (isExceeded) {
        updateRateLimits(env.req.ip);
        callback({
          code:    N.io.CLIENT_ERROR,
          message: env.t('err_too_many_attempts'),
          captcha: env.data.captcha_required
        });
        return;
      }

      callback();
    });
  });


  // Try to find auth data using `email_or_nick` as an email.
  //
  N.wire.on(apiPath, function find_authlink_by_email(env, callback) {
    if (env.data.user && env.data.authLink) {
      callback();
      return;
    }

    N.models.users.AuthLink
        .findOne({
          email: env.params.email_or_nick,
          type: 'plain',
          exists: true
        })
        .exec(function (err, authLink) {

      if (err) {
        callback(err);
        return;
      }

      if (!authLink) {
        callback(); // There is no error - let next hooks do their job.
        return;
      }

      N.models.users.User
        .findOne({ _id: authLink.user_id })
        .lean(true)
        .exec(function (err, user) {

        if (err) {
          callback(err);
          return;
        }

        if (!user) {
          callback(); // There is no error - let next hooks do their job.
          return;
        }

        env.data.user     = user;
        env.data.authLink = authLink;

        callback();
      });
    });
  });


  // Try to find auth data using `email_or_nick` as a nick.
  //
  N.wire.on(apiPath, function find_authlink_by_nick(env, callback) {
    if (env.data.user && env.data.authLink) {
      callback();
      return;
    }

    N.models.users.User
        .findOne({ nick: env.params.email_or_nick })
        .lean(true)
        .exec(function (err, user) {

      if (err) {
        callback(err);
        return;
      }

      if (!user) {
        callback(); // There is no error - let next hooks do their job.
        return;
      }

      N.models.users.AuthLink
          .findOne({ user_id: user._id, type: 'plain', exists: true })
          .exec(function (err, authLink) {

        if (err) {
          callback(err);
          return;
        }

        if (!authLink) {
          callback(); // There is no error - let next hooks do their job.
        }

        env.data.user     = user;
        env.data.authLink = authLink;

        callback();
      });
    });
  });


  // Check that user & plain authlink are ok
  //
  N.wire.on(apiPath, function check_fetched(env, callback) {

    if (!env.data.user || !env.data.authLink) {
      updateRateLimits(env.req.ip);
      callback({
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_login_failed'),
        fields:  [ 'email_or_nick', 'pass' ],
        captcha: env.data.captcha_required
      });
      return;
    }

    callback();
  });


  // Do login
  //
  N.wire.on(apiPath, function login_do(env, callback) {

    env.data.authLink.checkPass(env.params.pass, function (err, success) {
      if (err) {
        callback(err);
        return;
      }

      // password mismatch
      if (!success) {
        updateRateLimits(env.req.ip);
        callback({
          code:    N.io.CLIENT_ERROR,
          message: env.t('err_login_failed'),
          fields:  [ 'email_or_nick', 'pass' ],
          captcha: env.data.captcha_required
        });
        return;
      }

      // Set login redirect URL.
      env.data.redirect_id = env.params.redirect_id;

      N.wire.emit('internal:users.login', env, function () {
        env.res.redirect_url = env.data.redirect_url;
        callback();
      });
    });
  });
};
