// Update moderator's note for user
//
'use strict';


const parse_options = require('./_parse_options');


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    note_id:  { format: 'mongo', required: true },
    txt:      { type: 'string', required: true }
  });


  // Check auth and permissions
  //
  N.wire.before(apiPath, function* check_auth_and_permissions(env) {
    if (!env.user_info.is_member) throw N.io.NOT_FOUND;

    let can_add_mod_notes = yield env.extras.settings.fetch('can_add_mod_notes');

    if (!can_add_mod_notes) throw N.io.NOT_FOUND;
  });


  // Fetch note
  //
  N.wire.before(apiPath, function* fetch_note(env) {
    env.data.note = yield N.models.users.ModeratorNote
                              .findOne({ _id: env.params.note_id });

    if (!env.data.note) throw N.io.BAD_REQUEST;
  });


  // Check permission to edit
  //
  N.wire.before(apiPath, function* check_edit_permission(env) {
    let mod_notes_edit_max_time = yield env.extras.settings.fetch('mod_notes_edit_max_time');

    if (String(env.data.note.from) !== env.user_info.user_id) throw N.io.FORBIDDEN;

    if (mod_notes_edit_max_time !== 0 &&
      env.data.note.ts < Date.now() - mod_notes_edit_max_time * 60 * 1000) {
      throw {
        code: N.io.CLIENT_ERROR,
        message: env.t('err_perm_expired')
      };
    }
  });


  // Update note
  //
  N.wire.on(apiPath, function* update_note(env) {
    if (!env.params.txt.trim()) {
      // If text is empty, client should call `delete` instead,
      // so this exception should never appear in practice
      throw N.io.BAD_REQUEST;
    }

    let parse_result = yield N.parser.md2html({
      text:        env.params.txt,
      options:     parse_options,
      attachments: [],
      user_info:   env.user_info
    });

    env.data.note.md = env.params.txt;
    env.data.note.html = parse_result.html;

    yield env.data.note.save();
  });
};
