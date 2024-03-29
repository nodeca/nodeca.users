// Confirm new email
// This is the page shown when user clicks a link in their email
//

'use strict';


const parse_options = require('nodeca.users/server/users/mod_notes/_parse_options');
const crypto = require('crypto');


function get_short_code(length = 6) {
  return (crypto.randomBytes(4).readUInt32BE(0) + 10 ** (length + 1)).toString(10).slice(-length);
}


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    secret_key: { type: 'string', required: true }
  });


  // Create default response (with failing state)
  //
  N.wire.before(apiPath, function prepare_response(env) {
    env.res.head.title = env.t('title');
  });


  // Check auth token
  //
  N.wire.before(apiPath, async function check_token(env) {
    if (env.res.error) return;

    let token = await N.models.users.TokenEmailConfirmNew.findOne()
                          .where('secret_key').equals(env.params.secret_key)
                          .lean(true)
                          .exec();

    if (!token) {
      env.res.error = env.t('err_invalid_token');
      return;
    }

    env.data.token = token;
  });


  // Search for user
  //
  N.wire.before(apiPath, async function fetch_user(env) {
    if (env.res.error) return;

    let token = env.data.token;

    env.data.user = await N.models.users.User.findById(token.user).exec();

    if (!env.data.user) {
      env.res.error = env.t('err_invalid_token');
      return;
    }
  });


  // Generate code to log in from a different browser
  //
  N.wire.on(apiPath, async function generate_short_code(env) {
    if (env.res.error) return;

    // same device
    if (env.session_id && env.session_id === env.data.token.session_id) return;

    if (env.data.token.short_code) {
      // user opens email link in two different browsers, show code generated in first one
      env.res.short_code = env.data.token.short_code;
      return;
    }

    env.res.short_code = get_short_code();

    await N.models.users.TokenEmailConfirmNew.updateOne(
      { _id: env.data.token._id },
      { $set: {
        short_code: env.res.short_code,
        open_link_ts: new Date()
      } }
    );
  });


  // Change email
  //
  N.wire.on(apiPath, async function change_email(env) {
    if (env.res.error || env.res.short_code) return;

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
    if (env.res.error || env.res.short_code) return;

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
    if (env.res.error || env.res.short_code) return;

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
    if (env.res.error || env.res.short_code) return;

    await N.models.users.TokenEmailConfirmNew.deleteMany({ user: env.data.user._id });
  });


  // Redirect user to "change done" page
  //
  // Use redirect instead of direct page rendering to avoid "invalid token"
  // error appearing on reload + make it similar to other pages (auth flow,
  // change password, etc.)
  //
  N.wire.after(apiPath, async function redirect_user(env) {
    if (env.res.error || env.res.short_code) return;

    throw {
      code: N.io.REDIRECT,
      head: {
        Location: N.router.linkTo('users.settings.account.change_email.new_email_done')
      }
    };
  });
};
