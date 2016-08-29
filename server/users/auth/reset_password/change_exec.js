// Apply new password, entered by user.
//
'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    secret_key: { type: 'string', required: true },
    password:   { type: 'string', required: true }
  });


  //
  // Don't limit logged-in users to change pass. Because
  // user can forget password, but still have cookies to hemember him.
  //


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
  });


  // Check token
  //
  N.wire.before(apiPath, function* check_new_pass_token(env) {
    let token = yield N.models.users.TokenResetPassword
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
  N.wire.before(apiPath, function* fetch_user(env) {
    let token = env.data.token;

    env.data.user = yield N.models.users.User.findById(token.user);

    if (!env.data.user) {
      throw {
        code:         N.io.CLIENT_ERROR,
        message:      env.t('err_broken_token'),
        bad_password: false
      };
    }
  });


  // Update password & remove used token
  //
  N.wire.on(apiPath, function* update_password(env) {
    let authLink = yield N.models.users.AuthLink.findOne({ user: env.data.user._id, type: 'plain', exists: true });

    if (!authLink) {
      authLink = new N.models.users.AuthLink({
        user:    env.data.user._id,
        type:    'plain',
        email:   env.data.user.email,
        ip:      env.req.ip,
        last_ip: env.req.ip
      });
    }

    yield authLink.setPass(env.params.password);
    yield authLink.save();

    // keep it for logging in later on
    env.data.authLink = authLink;
  });


  // Remove current and all other password reset tokens for this user
  //
  N.wire.after(apiPath, function* remove_token(env) {
    yield N.models.users.TokenResetPassword.remove({ user: env.data.user._id });
  });


  // Auto login after password change
  //
  N.wire.after(apiPath, function* autologin(env) {
    yield N.wire.emit('internal:users.login', env);
  });


  // Send email
  //
  N.wire.after(apiPath, function* send_email(env) {
    let general_project_name = yield N.settings.get('general_project_name');

    yield N.mailer.send({
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
