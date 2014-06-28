// Login by `email` provider (email/password or nick/password)


'use strict';


var _         = require('lodash');
var recaptcha = require('nodeca.core/lib/recaptcha');


module.exports = function (N, apiPath) {
  var rateLimit = require('./_rate_limit')(N);


  // Don't set "required" flag, to manually fill
  N.validate(apiPath, {
    email_or_nick: { type: 'string' }
  , pass:          { type: 'string' }
  , recaptcha_challenge_field: { type: 'string', 'default': '' }
  , recaptcha_response_field:  { type: 'string', 'default': '' }
  , redirect_id: { format: 'mongo' }
  });


  // Touch rate limits in lazy style - do not wait for callbacks.
  //
  function updateRateLimits(clientIp) {
    rateLimit.ip.update(clientIp);
    rateLimit.total.update();
  }


  N.wire.before(apiPath, function login_guest_only(env, callback) {
    N.wire.emit('internal:users.redirect_not_guest', env, callback);
  });


  // If there is neither email_or_nick or pass - stop before database queries.
  //
  N.wire.before(apiPath, function check_params(env) {
    if (_.isEmpty(env.params.email_or_nick) ||
        _.isEmpty(env.params.pass)) {
      return {
        code:    N.io.CLIENT_ERROR
      , message: env.t('login_failed')
      , fields:  ['email_or_nick', 'pass']
      , captcha: false
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

      var privateKey = N.config.options.recaptcha.private_key
        , clientIp   = env.req.ip
        , challenge  = env.params.recaptcha_challenge_field
        , response   = env.params.recaptcha_response_field;

      if (!response) {
        updateRateLimits(clientIp);
        callback({
          code:    N.io.CLIENT_ERROR
        , message: env.t('missed_captcha_solution')
        , captcha: env.data.captcha_required
        });
        return;
      }

      recaptcha.verify(privateKey, clientIp, challenge, response, function (err, valid) {
        if (err || !valid) {
          updateRateLimits(clientIp);
          callback({
            code:    N.io.CLIENT_ERROR
          , message: env.t('wrong_captcha_solution')
          , fields:  ['recaptcha_response_field']
          , captcha: env.data.captcha_required
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
          code:    N.io.CLIENT_ERROR
        , message: env.t('too_many_attempts')
        , fields:  ['recaptcha_response_field']
        , captcha: env.data.captcha_required
        });
        return;
      }

      callback();
    });
  });


  // Try to find auth data using `email_or_nick` as an email.
  //
  N.wire.on(apiPath, function find_authlink_by_email(env, callback) {
    if (env.data.user && env.data.provider) {
      callback();
      return;
    }

    N.models.users.AuthLink
      .findOne({ 'providers.email': env.params.email_or_nick, 'providers.type': 'plain' })
      .exec(function (err, authlink) {

      if (err) {
        callback(err);
        return;
      }

      if (!authlink) {
        callback(); // There is no error - let next hooks do their job.
        return;
      }

      N.models.users.User
        .findOne({ '_id': authlink.user_id })
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
        env.data.provider = _.find(authlink.providers, {
          type: 'plain'
        , email: env.params.email_or_nick
        });

        callback();
      });
    });
  });


  // Try to find auth data using `email_or_nick` as a nick.
  //
  N.wire.on(apiPath, function find_authlink_by_nick(env, callback) {
    if (env.data.user && env.data.provider) {
      callback();
      return;
    }

    N.models.users.User
      .findOne({ 'nick': env.params.email_or_nick })
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
        .findOne({ 'user_id': user._id, 'providers.type': 'plain' })
        .exec(function (err, authlink) {

        if (err) {
          callback(err);
          return;
        }

        if (!authlink) {
          callback(); // There is no error - let next hooks do their job.
        }

        env.data.user     = user;
        env.data.provider = _.find(authlink.providers, { type: 'plain' });

        callback();
      });
    });
  });


  N.wire.on(apiPath, function login_do(env, callback) {
    // user not found or doesn't have authlink record for plain login
    if (!env.data.user || !env.data.provider) {
      updateRateLimits(env.req.ip);
      callback({
        code:    N.io.CLIENT_ERROR,
        message: env.t('login_failed'),
        fields:  ['email_or_nick', 'pass'],
        captcha: env.data.captcha_required
      });
      return;
    }

    env.data.provider.checkPass(env.params.pass, function(err, success) {
      if (err) {
        callback(err);
        return;
      }

      // password mismatch
      if (!success) {
        updateRateLimits(env.req.ip);
        callback({
          code:    N.io.CLIENT_ERROR
        , message: env.t('login_failed')
        , fields:  ['email_or_nick', 'pass']
        , captcha: env.data.captcha_required
        });
        return;
      }

      // Apply login.
      N.wire.emit('internal:users.login', env, callback);
    });
  });


  // Fill redirect url
  //
  N.wire.after(apiPath, function get_redirect_url(env, callback) {

    // TODO: add setting for default redirect url ?

    // fill redirect with default value
    env.res.redirect_url = N.runtime.router.linkTo('users.profile_redirect');

    // if no specific redirect requested - redirect to default
    if (!env.params.redirect_id) {
      callback();
      return;
    }

    N.models.users.LoginRedirect
        .findOne({ '_id': env.params.redirect_id })
        .lean(true)
        .exec(function (err, link) {

      if (err) {
        callback(err);
        return;
      }

      // If redirect requested, but not found - redirect to default.
      // In other case, we have to mark redirect as used.

      if (!link) {
        callback();
        return;
      }

      // update redirect if conditions are valid

      if (!link.used && link.ip && link.ip === env.req.ip) {
        env.res.redirect_url = link.url;
      }

      // mark link as used and return

      N.models.users.LoginRedirect
          .findByIdAndUpdate(env.params.redirect_id, { $set: { used: true } })
          .lean(true)
          .exec(function (err) {
        callback(err);
      });
    });
  });
};
