// Creates new password reset token and send it to user's email.


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});


  // Check permissions
  //
  N.wire.before(apiPath, function check_permissions(env) {
    if (!env.user_info.is_member) {
      return N.io.FORBIDDEN;
    }
  });


  // Fetch user
  //
  N.wire.before(apiPath, async function fetch_user(env) {
    env.data.user = await N.models.users.User.findById(env.user_info.user_id).lean(true);
  });


  // Create token & send email
  //
  N.wire.on(apiPath, async function create_reset_confirmation(env) {
    let token = await N.models.users.TokenResetPassword.create({
      user:       env.data.user._id,
      session_id: env.session_id
    });

    let general_project_name = await N.settings.get('general_project_name');

    let link = env.helpers.link_to('users.auth.reset_password.change_show', {
      secret_key: token.secret_key
    });

    await N.mailer.send({
      to:         env.data.user.email,
      subject:    env.t('email_subject', { project_name: general_project_name }),
      text:       env.t('email_text',    { link, code: token.secret_key, ip: env.req.ip }),
      safe_error: true
    });
  });
};
