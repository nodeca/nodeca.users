// Do login by `plain` provider (email/password or nick/password)


'use strict';


const _         = require('lodash');
const recaptcha = require('nodeca.core/lib/recaptcha');


module.exports = function (N, apiPath) {

  // Don't set "required" flag, to manually check data &
  // fill form errors
  //
  N.validate(apiPath, {
    email_or_nick: { type: 'string' },
    pass:          { type: 'string' },
    'g-recaptcha-response':  { type: 'string' },
    redirect_id: { format: 'mongo' }
  });


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
        message: env.t('err_login_failed')
      };
    }
  });


  // Check for too many total logins (60 attempts / 60 seconds).
  // That can cause too hight CPU use in bcrypt.
  // Do soft limit - ask user to enter captcha to make sure he is not a bot.
  //
  N.wire.before(apiPath, function check_total_rate_limit(env, callback) {
    if (!N.config.options.recaptcha) {
      callback();
      return;
    }

    var privateKey = N.config.options.recaptcha.private_key,
        clientIp   = env.req.ip,
        response   = env.params['g-recaptcha-response'];

    if (!response) {
      callback({
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_captcha_wrong')
      });
      return;
    }

    recaptcha.verify(privateKey, clientIp, response, function (err, valid) {
      if (err) {
        callback(new Error('Captcha service error'));
        return;
      }

      if (!valid) {
        callback({
          code:    N.io.CLIENT_ERROR,
          message: env.t('err_captcha_wrong')
        });
        return;
      }

      callback();
    });
  });


  // Try to find auth data using `email_or_nick` as an email.
  //
  N.wire.on(apiPath, function* find_authlink_by_email(env) {
    // user already verified by hooks, nothing left to do
    if (env.data.authLink) return;

    if (env.data.user && env.data.authLink_plain) return;

    let authLink = yield N.models.users.AuthLink
                            .findOne({
                              email: env.params.email_or_nick,
                              type: 'plain',
                              exists: true
                            });

    if (!authLink) return;

    let user = yield N.models.users.User
                        .findOne({ _id: authLink.user_id })
                        .lean(true);

    // There is no error - let next hooks do their job.
    if (!user) return;

    env.data.user = user;
    env.data.authLink_plain = authLink;
  });


  // Try to find auth data using `email_or_nick` as a nick.
  //
  N.wire.on(apiPath, function* find_authlink_by_nick(env) {
    // user already verified by hooks, nothing left to do
    if (env.data.authLink) return;

    if (env.data.user && env.data.authLink_plain) return;

    let user = yield N.models.users.User
      .findOne({ nick: env.params.email_or_nick })
      .lean(true);

    // There is no error - let next hooks do their job.
    if (!user) return;

    let authLink = yield N.models.users.AuthLink
      .findOne({ user_id: user._id, type: 'plain', exists: true });

    // There is no error - let next hooks do their job.
    if (!authLink) return;

    env.data.user = user;
    env.data.authLink_plain = authLink;
  });


  // Try to login using plain authlink
  //
  N.wire.on(apiPath, function* verify_authlink(env) {
    if (!env.data.user || !env.data.authLink_plain) return;

    let success = yield env.data.authLink_plain.checkPass(env.params.pass);

    if (success) {
      env.data.authLink = env.data.authLink_plain;
    }
  });


  // Do login
  //
  N.wire.after(apiPath, function* login_do(env) {
    // if env.data.authLink variable is set, it means this authlink
    // has been verified, and password matches
    if (!env.data.authLink) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_login_failed')
      };
    }

    // Set login redirect URL.
    env.data.redirect_id = env.params.redirect_id;

    yield N.wire.emit('internal:users.login', env);

    env.res.redirect_url = env.data.redirect_url;
  });
};
