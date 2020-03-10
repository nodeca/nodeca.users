// Show a form allowing user to change email
//

'use strict';


const _ = require('lodash');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    pass: { type: 'string', required: true }
  });


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


  // If user tries to change email without entering password, send link/code to email
  //
  N.wire.before(apiPath, { priority: -5 }, async function create_otp_email_token(env) {
    if (!_.isEmpty(env.params.pass)) return;

    let token = await N.models.users.TokenEmailChange.create({
      session_id: env.session_id,
      user:       env.data.user._id
    });

    let general_project_name = await N.settings.get('general_project_name');

    let link = env.helpers.link_to('users.settings.account.change_email.change_show', {
      secret_key: token.secret_key
    });

    await N.mailer.send({
      to:         env.data.user.email,
      subject:    env.t('email_subject', { project_name: general_project_name }),
      text:       env.t('email_text',    { link, code: token.secret_key, ip: env.req.ip }),
      safe_error: true
    });

    throw {
      code: N.io.REDIRECT,
      head: {
        Location: N.router.linkTo('users.settings.account.change_email.request_done_show')
      }
    };
  });


  // Try to find auth provider corresponding to password
  //
  N.wire.on(apiPath, async function find_authprovider(env) {
    let authProvider = await N.models.users.AuthProvider
      .findOne({ user: env.data.user._id, type: 'plain', exists: true });

    // try to login using it
    let success = authProvider && (await authProvider.checkPass(env.params.pass));

    if (!success) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_wrong_password')
      };
    }

    let token = await N.models.users.TokenEmailChange.create({
      session_id: env.session_id,
      user:       env.data.user._id
    });

    throw {
      code: N.io.REDIRECT,
      head: {
        Location: N.router.linkTo('users.settings.account.change_email.change_show', {
          secret_key: token.secret_key
        })
      }
    };
  });
};
