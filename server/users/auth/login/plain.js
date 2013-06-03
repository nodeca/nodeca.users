// Login by `email` provider (email/password or nick/password)


'use strict';


var _         = require('lodash');
var recaptcha = require('nodeca.core/lib/recaptcha');


module.exports = function (N, apiPath) {
  var rateLimit = require('./_rate_limit')(N);


  N.validate(apiPath, {
    email_or_nick: { type: 'string', required: true }
  , pass:          { type: 'string', required: true }
  , recaptcha_challenge_field: { type: 'string', 'default': '' }
  , recaptcha_response_field:  { type: 'string', 'default': '' }
  });


  // Touch rate limits in lazy style - do not wait for callbacks.
  //
  function updateRateLimits(clientIp) {
    rateLimit.ip.update(clientIp);
    rateLimit.total.update();
  }


  // If there is neither email_or_nick or pass - stop before database queries.
  //
  N.wire.before(apiPath, { priority: -15 }, function check_params(env) {
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
  N.wire.before(apiPath, { priority: -10 }, function check_total_rate_limit(env, callback) {
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
        , clientIp   = env.request.ip
        , challenge  = env.params.recaptcha_challenge_field
        , response   = env.params.recaptcha_response_field;

      if (!response) {
        updateRateLimits(clientIp);
        callback({
          code:    N.io.CLIENT_ERROR
        , message: env.t('missed_captcha_response')
        , captcha: env.data.captcha_required
        });
        return;
      }

      recaptcha.verify(privateKey, clientIp, challenge, response, function (err, valid) {
        if (err || !valid) {
          updateRateLimits(clientIp);
          callback({
            code:    N.io.CLIENT_ERROR
          , message: env.t('wrong_captcha_response')
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
  N.wire.before(apiPath, { priority: -10 }, function check_ip_rate_limit(env, callback) {
    rateLimit.ip.check(env.request.ip, function (err, isExceeded) {
      if (err) {
        callback(err);
        return;
      }

      if (isExceeded) {
        updateRateLimits(env.request.ip);
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
  N.wire.before(apiPath, { priority: -5 }, function find_authlink_by_email(env, callback) {
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
          .exec(function (err, user) {

        if (err || !user) {
          callback(err);
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
  N.wire.before(apiPath, { priority: -5 }, function find_authlink_by_nick(env, callback) {
    if (env.data.user && env.data.provider) {
      callback();
      return;
    }

    N.models.users.User
        .findOne({ 'nick': env.params.email_or_nick })
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

        if (err || !authlink) {
          callback(err);
          return;
        }

        env.data.user     = user;
        env.data.provider = _.find(authlink.providers, { type: 'plain' });

        callback();
      });
    });
  });


  N.wire.on(apiPath, function (env, callback) {
    if (!env.data.user     ||
        !env.data.provider ||
        !env.data.provider.checkPass(env.params.pass)) {

      updateRateLimits(env.request.ip);
      callback({
        code:    N.io.CLIENT_ERROR
      , message: env.t('login_failed')
      , fields:  ['email_or_nick', 'pass']
      , captcha: env.data.captcha_required
      });
      return;
    }

    // Apply login.
    env.session.user_id = env.data.user._id;
    callback();
  });
};
