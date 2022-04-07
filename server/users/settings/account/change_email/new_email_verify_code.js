// Confirm new email
// RPC method that verifies key or code entered by user
//

'use strict';


const parse_options = require('nodeca.users/server/users/mod_notes/_parse_options');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    // either secret_key or short_code
    secret_key_or_code: { type: 'string', required: true, minLength: 1 }
  });


  // Check permissions
  //
  N.wire.before(apiPath, function check_permissions(env) {
    if (!env.user_info.is_member) {
      return N.io.FORBIDDEN;
    }
  });


  // Check token
  //
  N.wire.before(apiPath, async function check_token(env) {
    let token = await N.models.users.TokenEmailConfirmNew.findOneAndUpdate(
      { session_id: env.session_id },
      { $inc: { attempts: 1 } },
      { new: true }
    ).lean(true).exec();

    if (!token || !env.session_id || String(token.user) !== String(env.user_info.user_id)) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_invalid_token')
      };
    }

    if (token.attempts > 3) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_too_many_attempts')
      };
    }

    let code_correct = false;

    if (token.secret_key && token.secret_key === env.params.secret_key_or_code) code_correct = true;
    if (token.short_code && token.short_code === env.params.secret_key_or_code) {
      if (Math.abs(Date.now() - token.open_link_ts) < 5 * 60 * 1000) {
        code_correct = true;
      } else {
        throw {
          code:    N.io.CLIENT_ERROR,
          message: env.t('err_expired_code')
        };
      }
    }

    if (!code_correct) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_invalid_code')
      };
    }

    env.data.token = token;
  });


  // Search for user
  //
  N.wire.before(apiPath, async function fetch_user(env) {
    let token = env.data.token;

    env.data.user = await N.models.users.User.findById(token.user).exec();

    if (!env.data.user) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_invalid_token')
      };
    }
  });


  // Change email
  //
  N.wire.on(apiPath, async function change_email(env) {
    env.data.old_email = env.data.user.email;
    env.data.user.email = env.data.token.new_email;

    await env.data.user.save();

    // disable all email authproviders
    // (authprovider for new email will be created on next login)
    await N.models.users.AuthProvider.updateMany(
      { user: env.data.user._id, type: 'email' },
      { $set: { exists: false } }
    );

    // replace email in plain authprovider
    let authProvider = await N.models.users.AuthProvider.findOne()
                                 .where('user').equals(env.data.user._id)
                                 .where('type').equals('plain')
                                 .where('exists').equals(true)
                                 .lean(false);

    if (authProvider) {
      authProvider.email = env.data.user.email;
      await authProvider.save();
    }
  });


  // Send notification to the old email
  //
  N.wire.after(apiPath, async function send_email(env) {
    let general_project_name = await N.settings.get('general_project_name');

    await N.mailer.send({
      to: env.data.old_email,
      subject: env.t('email_subject', { project_name: general_project_name }),
      html: env.t('email_text', {
        nick: env.data.user.nick,
        project_name: general_project_name,
        old_email: env.data.old_email,
        new_email: env.data.user.email,
        time: env.helpers.date(Date.now(), 'datetime'),
        ip: env.req.ip
      })
    });
  });


  // Log this change in moderator notes
  //
  N.wire.after(apiPath, async function save_log_in_moderator_notes(env) {
    let md_text = env.t('mod_note_text', {
      old_email: env.data.old_email,
      new_email: env.data.user.email
    });

    let parse_result = await N.parser.md2html({
      text:        md_text,
      options:     parse_options,
      user_info:   env.user_info
    });

    let bot = await N.models.users.User.findOne()
                        .where('hid').equals(N.config.bots.default_bot_hid)
                        .lean(true);

    let note = new N.models.users.ModeratorNote({
      from: bot._id,
      to:   env.data.user._id,
      md:   env.params.txt,
      html: parse_result.html
    });

    await note.save();
  });


  // Remove current and all other email confirmation tokens for this user
  //
  N.wire.after(apiPath, async function remove_token(env) {
    await N.models.users.TokenEmailConfirmNew.deleteMany({ user: env.data.user._id });
  });


  // Redirect user to "change done" page
  //
  // Use redirect instead of direct page rendering to avoid "invalid token"
  // error appearing on reload + make it similar to other pages (auth flow,
  // change password, etc.)
  //
  N.wire.after(apiPath, async function redirect_user() {
    throw {
      code: N.io.REDIRECT,
      head: {
        Location: N.router.linkTo('users.settings.account.change_email.new_email_done')
      }
    };
  });
};
