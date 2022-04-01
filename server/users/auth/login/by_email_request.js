// Send a login token to email
//

'use strict';


const recaptcha = require('nodeca.core/lib/app/recaptcha');


module.exports = function (N, apiPath) {

  // Don't set "required" flag, to manually check data &
  // fill form errors
  //
  N.validate(apiPath, {
    email_or_nick: { type: 'string' },
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
        message: env.t('err_nick_not_found')
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

    // allow to do plain login and subsequent email login using the same captcha
    if (await N.redis.del('captcha_login_bypass:' + env.params.email_or_nick + ':' + response)) {
      return;
    }

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
  N.wire.before(apiPath, { priority: -5 }, async function find_authprovider_by_email(env) {
    if (env.data.user && env.data.authProvider_email) return;

    let authProvider = await N.models.users.AuthProvider.findOne()
                                 .where('email_lc').equals(env.params.email_or_nick.toLowerCase())
                                 .where('type').equals('email')
                                 .where('exists').equals(true)
                                 .lean(true);

    if (!authProvider) return;

    let user = await N.models.users.User.findById(authProvider.user)
                         .lean(true);

    // There is no error - let next hooks do their job.
    if (!user) return;

    env.data.user = user;
    env.data.authProvider_email = authProvider;
  });


  // Try to find auth data using `email_or_nick` as a nick.
  //
  N.wire.before(apiPath, { priority: -5 }, async function find_authprovider_by_nick(env) {
    if (env.data.user && env.data.authProvider_email) return;

    let user = await N.models.users.User.findOne()
                         .where('nick').equals(env.params.email_or_nick)
                         .lean(true);

    // There is no error - let next hooks do their job.
    if (!user) return;

    let authProvider = await N.models.users.AuthProvider.findOne()
                                 .where('user').equals(user._id)
                                 .where('type').equals('email')
                                 .where('exists').equals(true)
                                 .lean(true);

    // There is no error - let next hooks do their job.
    if (!authProvider) return;

    env.data.user = user;
    env.data.authProvider_email = authProvider;
  });


  // Create authlink if it doesn't exist
  //
  N.wire.before(apiPath, { priority: -5 }, async function create_email_authlink(env) {
    if (env.data.user && env.data.authProvider_email) return;

    let user = await N.models.users.User.findOne()
                         .where('email').equals(env.params.email_or_nick)
                         .lean(true);

    if (!user) {
      user = await N.models.users.User.findOne()
                       .where('nick').equals(env.params.email_or_nick)
                       .lean(true);
    }

    if (!user) return;

    env.data.user = user;
    env.data.authProvider_email = await N.models.users.AuthProvider.create({
      user:    user._id,
      type:    'email',
      email:   user.email,
      ip:      env.req.ip,
      last_ip: env.req.ip
    });
  });


  // If password is empty, send an email with a one-time link to log in
  //
  N.wire.on(apiPath, async function create_otp_email_token(env) {
    if (!env.data.user || !env.data.authProvider_email) return;

    // user already verified by other hooks, nothing left to do
    if (env.data.authProvider) return;

    // remove any existing tokens for this session
    await N.models.users.TokenLoginByEmail.deleteMany({ session_id: env.session_id });

    let token = await N.models.users.TokenLoginByEmail.create({
      user:         env.data.user._id,
      session_id:   env.session_id,
      redirect_id:  env.params.redirect_id,
      authprovider: env.data.authProvider_email._id
    });

    let general_project_name = await N.settings.get('general_project_name');

    let link = env.helpers.link_to('users.auth.login.by_email_exec', {
      secret_key: token.secret_key
    });

    await N.mailer.send({
      to:         env.data.authProvider_email.email,
      subject:    env.t('email_subject', { project_name: general_project_name }),
      text:       env.t('email_text',    { link, code: token.secret_key, ip: env.req.ip }),
      safe_error: true
    });

    throw {
      code: N.io.REDIRECT,
      head: {
        Location: N.router.linkTo('users.auth.login.by_email_show')
      }
    };
  });


  // Do login
  //
  N.wire.after(apiPath, async function login_do(env) {
    // if env.data.authProvider variable is set, it means this authprovider
    // has been verified, and password matches
    if (!env.data.authProvider) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.params.email_or_nick.includes('@') ?
                 env.t('err_email_not_found') :
                 env.t('err_nick_not_found')
      };
    }

    // Set login redirect URL.
    env.data.redirect_id = env.params.redirect_id;

    await N.wire.emit('internal:users.login', env);

    env.res.redirect_url = env.data.redirect_url;
  });
};
