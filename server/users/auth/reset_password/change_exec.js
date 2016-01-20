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


  // Fetch user authlink/provider data
  //
  N.wire.before(apiPath, function* fetch_user_auth_data(env) {
    let token = env.data.token;
    let authLink = yield N.models.users.AuthLink.findById(token.authlink_id);

    if (!authLink) {
      throw {
        code:         N.io.CLIENT_ERROR,
        message:      env.t('broken_token'),
        bad_password: false
      };
    }

    env.data.authLink = authLink;
  });


  // Update password & remove used token
  //
  N.wire.on(apiPath, function* update_password(env) {
    let authLink = env.data.authLink;

    yield authLink.setPass(env.params.password);
    yield authLink.save();
  });


  // Remove current and all other password reset tokens for this provider.
  //
  N.wire.after(apiPath, function* remove_token(env) {
    yield N.models.users.TokenResetPassword.remove({ authlink_id: env.data.authLink._id });
  });


  // Auto login after password change
  //
  N.wire.after(apiPath, function* autologin(env) {
    env.data.user = yield N.models.users.User.findById(env.data.authLink.user_id);
    yield N.wire.emit('internal:users.login', env);
  });


  // Send email
  //
  N.wire.after(apiPath, function send_email(env, callback) {
    N.settings.get('general_project_name', function (err, general_project_name) {
      if (err) {
        callback(err);
        return;
      }

      N.mailer.send({
        to: env.data.authLink.email,
        subject: env.t('email_subject', { project_name: general_project_name }),
        text: env.t('email_text', {
          nick: env.data.user.nick,
          project_name: general_project_name,
          time: env.helpers.date(Date.now(), 'datetime'),
          ip: env.req.ip
        })
      }, callback);
    });
  });
};
