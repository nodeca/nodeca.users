// Delete avatar
//

'use strict';


const parse_options = require('nodeca.users/server/users/mod_notes/_parse_options');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    user_hid: { type: 'integer', minimum: 1, required: true }
  });


  // Fetch member by 'user_hid'
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env) {
    return N.wire.emit('internal:users.fetch_user_by_hid', env);
  });


  // Delete avatar
  //
  N.wire.on(apiPath, function delete_avatar(env) {
    return N.models.users.User.updateOne({ _id: env.data.user._id }, { $unset: { avatar_id: true } });
  });


  // Remove avatar from file store
  //
  N.wire.after(apiPath, async function remove_avatar_file(env) {
    if (!env.data.user.avatar_id) return;

    await N.models.core.File.remove(env.data.user.avatar_id, true);
  });


  // Log this change in moderator notes
  //
  N.wire.after(apiPath, async function save_log_in_moderator_notes(env) {
    let md_text = env.t('mod_note_text', {
      admin_nick: env.user_info.user_name,
      admin_link: N.router.linkTo('users.member', { user_hid: env.user_info.user_hid })
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
};
