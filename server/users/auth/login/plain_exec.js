// Do login by `plain` provider (email/password or nick/password)


'use strict';


const _         = require('lodash');
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
    if (_.isEmpty(env.params.email_or_nick)) {
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
                              email: env.params.email_or_nick,
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


  // If password is empty, send an email with a one-time link to log in
  //
  N.wire.on(apiPath, async function create_otp_email_token(env) {
    if (!env.data.user || !env.data.authProvider_plain) return;

    // user already verified by other hooks, nothing left to do
    if (env.data.authProvider) return;

    if (!_.isEmpty(env.params.pass)) return;

    let token = await N.models.users.TokenLoginByEmail.create({
      user:         env.data.user._id,
      session_id:   env.session_id,
      redirect_id:  env.params.redirect_id,
      authprovider: env.data.authProvider_plain._id
    });

    let general_project_name = await N.settings.get('general_project_name');

    let link = env.helpers.link_to('users.auth.login.by_email_exec', {
      secret_key: token.secret_key
    });

    // add a space after each 10th digit for readability
    let code = token.secret_key.match(/.{1,10}/g).join(' ');

    await N.mailer.send({
      to:         env.data.authProvider_plain.email,
      subject:    env.t('email_subject', { project_name: general_project_name }),
      text:       env.t('email_text',    { link, code, ip: env.req.ip }),
      safe_error: true
    });

    throw {
      code: N.io.REDIRECT,
      head: {
        Location: N.router.linkTo('users.auth.login.by_email_show')
      }
    };
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
        message: env.t('err_login_failed')
      };
    }

    // Set login redirect URL.
    env.data.redirect_id = env.params.redirect_id;

    await N.wire.emit('internal:users.login', env);

    env.res.redirect_url = env.data.redirect_url;
  });
};
