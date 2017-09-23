// Apply new password, entered by user.
//
'use strict';

const _   = require('lodash');
const url = require('url');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    secret_key: { type: 'string', required: true },
    password:   { type: 'string', required: true }
  });


  //
  // Don't limit logged-in users to change pass. Because
  // user can forget password, but still have cookies to hemember him.
  //


  // Check token
  //
  N.wire.before(apiPath, async function check_new_pass_token(env) {
    let token = await N.models.users.TokenResetPassword
                          .findOne({ secret_key: env.params.secret_key })
                          .lean(true);

    if (!token) {
      throw {
        code:         N.io.CLIENT_ERROR,
        message:      env.t('err_expired_token'),
        bad_password: false
      };
    }

    if (token.ip !== env.req.ip) {
      throw {
        code:         N.io.CLIENT_ERROR,
        message:      env.t('err_broken_token'),
        bad_password: false
      };
    }

    env.data.token = token;
  });


  // Search for user
  //
  N.wire.before(apiPath, async function fetch_user(env) {
    let token = env.data.token;

    env.data.user = await N.models.users.User.findById(token.user);

    if (!env.data.user) {
      throw {
        code:         N.io.CLIENT_ERROR,
        message:      env.t('err_broken_token'),
        bad_password: false
      };
    }
  });


  // Validate new password
  //
  N.wire.before(apiPath, function validate_password(env) {
    if (!N.models.users.User.validatePassword(env.params.password)) {
      return {
        code:         N.io.CLIENT_ERROR,
        message:      null,
        bad_password: true
      };
    }

    // forbid password equal to user nickname
    if (env.params.password.toLowerCase() === env.data.user.nick.toLowerCase()) {
      return {
        code:         N.io.CLIENT_ERROR,
        message:      env.t('err_password_is_nick'),
        bad_password: true
      };
    }

    // forbid password equal to user email address
    if (env.params.password.toLowerCase() === env.data.user.email.toLowerCase()) {
      return {
        code:         N.io.CLIENT_ERROR,
        message:      env.t('err_password_is_email'),
        bad_password: true
      };
    }

    // forbid password equal to hostname
    let mount = _.get(N.config, 'bind.default.mount', '/');
    let hostname = url.parse(mount).hostname;

    if (hostname) {
      if (env.params.password.toLowerCase() === hostname.toLowerCase()) {
        return {
          code:         N.io.CLIENT_ERROR,
          message:      env.t('err_password_is_hostname'),
          bad_password: true
        };
      }
    }
  });


  // Update password & remove used token
  //
  N.wire.on(apiPath, async function update_password(env) {
    let authProvider = await N.models.users.AuthProvider.findOne({
      user: env.data.user._id,
      type: 'plain',
      exists: true
    });

    if (!authProvider) {
      authProvider = new N.models.users.AuthProvider({
        user:    env.data.user._id,
        type:    'plain',
        email:   env.data.user.email,
        ip:      env.req.ip,
        last_ip: env.req.ip
      });
    }

    await authProvider.setPass(env.params.password);
    await authProvider.save();

    // keep it for logging in later on
    env.data.authProvider = authProvider;
  });


  // Remove current and all other password reset tokens for this user
  //
  N.wire.after(apiPath, async function remove_token(env) {
    await N.models.users.TokenResetPassword.remove({ user: env.data.user._id });
  });


  // Auto login after password change
  //
  N.wire.after(apiPath, async function autologin(env) {
    await N.wire.emit('internal:users.login', env);
  });


  // Send email
  //
  N.wire.after(apiPath, async function send_email(env) {
    let general_project_name = await N.settings.get('general_project_name');

    await N.mailer.send({
      to: env.data.user.email,
      subject: env.t('email_subject', { project_name: general_project_name }),
      html: env.t('email_text', {
        nick: env.data.user.nick,
        project_name: general_project_name,
        time: env.helpers.date(Date.now(), 'datetime'),
        ip: env.req.ip
      })
    });
  });
};
