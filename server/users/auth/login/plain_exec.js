// Do login by `plain` provider (email/password or nick/password)


'use strict';


const recaptcha = require('nodeca.core/lib/app/recaptcha');


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
  N.wire.before(apiPath, function login_guest_only(env) {
    return N.wire.emit('internal:users.redirect_not_guest', env);
  });


  // If email_or_nick is not specified, stop before database queries.
  //
  N.wire.before(apiPath, function check_params(env) {
    if (!env.params.email_or_nick) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_login_failed')
      };
    }
  });


  // Check for too many total logins (60 attempts / 60 seconds).
  // That can cause too hight CPU use in bcrypt.
  // Do soft limit - ask user to enter captcha to make sure he is not a bot.
  //
  N.wire.before(apiPath, async function check_total_rate_limit(env) {
    if (!N.config.options.recaptcha) return;

    let privateKey = N.config.options.recaptcha.private_key,
        clientIp   = env.req.ip,
        response   = env.params['g-recaptcha-response'];

    if (!response) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_captcha_wrong')
      };
    }

    let valid = await recaptcha.verify(privateKey, clientIp, response);

    if (!valid) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_captcha_wrong')
      };
    }
  });


  // Try to find auth data using `email_or_nick` as an email.
  //
  N.wire.on(apiPath, async function find_authprovider_by_email(env) {
    // user already verified by hooks, nothing left to do
    if (env.data.authProvider) return;

    if (env.data.user && env.data.authProvider_plain) return;

    let authProvider = await N.models.users.AuthProvider
                            .findOne({
                              email_lc: env.params.email_or_nick.toLowerCase(),
                              type: 'plain',
                              exists: true
                            });

    if (!authProvider) return;

    let user = await N.models.users.User
                        .findOne({ _id: authProvider.user })
                        .lean(true);

    // There is no error - let next hooks do their job.
    if (!user) return;

    env.data.user = user;
    env.data.authProvider_plain = authProvider;
  });


  // Try to find auth data using `email_or_nick` as a nick.
  //
  N.wire.on(apiPath, async function find_authprovider_by_nick(env) {
    // user already verified by hooks, nothing left to do
    if (env.data.authProvider) return;

    if (env.data.user && env.data.authProvider_plain) return;

    let user = await N.models.users.User
      .findOne({ nick: env.params.email_or_nick })
      .lean(true);

    // There is no error - let next hooks do their job.
    if (!user) return;

    let authProvider = await N.models.users.AuthProvider
      .findOne({ user: user._id, type: 'plain', exists: true });

    // There is no error - let next hooks do their job.
    if (!authProvider) return;

    env.data.user = user;
    env.data.authProvider_plain = authProvider;
  });


  // Try to login using plain authprovider
  //
  N.wire.on(apiPath, async function verify_authprovider(env) {
    if (!env.data.user || !env.data.authProvider_plain) return;

    let success = await env.data.authProvider_plain.checkPass(env.params.pass);

    if (success) {
      env.data.authProvider = env.data.authProvider_plain;
    }
  });


  // Do login
  //
  N.wire.after(apiPath, async function login_do(env) {
    // if env.data.authProvider variable is set, it means this authprovider
    // has been verified, and password matches
    if (!env.data.authProvider) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_login_failed'),
        wrong_password: true
      };
    }

    // Set login redirect URL.
    env.data.redirect_id = env.params.redirect_id;

    await N.wire.emit('internal:users.login', env);

    env.res.redirect_url = env.data.redirect_url;
  });
};
