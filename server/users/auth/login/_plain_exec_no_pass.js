// If user tries to log in without password, send login link/code to email
//

'use strict';


module.exports = function (N, apiPath) {

  // Try to find auth data using `email_or_nick` as an email.
  //
  N.wire.before(apiPath, { priority: -5 }, async function find_authprovider_by_email(env) {
    if (env.params.pass) return;
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
    if (env.params.pass) return;
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
    if (env.params.pass) return;
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
  N.wire.before(apiPath, { priority: -5 }, async function create_otp_email_token(env) {
    if (env.params.pass) return;

    if (!env.data.user || !env.data.authProvider_email) return;

    // user already verified by other hooks, nothing left to do
    if (env.data.authProvider) return;

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
};
