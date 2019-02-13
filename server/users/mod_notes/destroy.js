// Delete moderator's note for user
//
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    note_id:  { format: 'mongo', required: true }
  });


  // Check auth and permissions
  //
  N.wire.before(apiPath, async function check_auth_and_permissions(env) {
    if (!env.user_info.is_member) throw N.io.NOT_FOUND;

    let can_add_mod_notes = await env.extras.settings.fetch('can_add_mod_notes');

    if (!can_add_mod_notes) throw N.io.NOT_FOUND;
  });


  // Fetch note
  //
  N.wire.before(apiPath, async function fetch_note(env) {
    env.data.note = await N.models.users.ModeratorNote
                              .findOne({ _id: env.params.note_id });

    if (!env.data.note) throw N.io.BAD_REQUEST;
  });


  // Check permission to delete
  //
  N.wire.before(apiPath, async function check_delete_permission(env) {
    let can_delete_mod_notes = await env.extras.settings.fetch('can_delete_mod_notes');

    if (can_delete_mod_notes) return;

    let mod_notes_edit_max_time = await env.extras.settings.fetch('mod_notes_edit_max_time');

    if (String(env.data.note.from) !== env.user_info.user_id) throw N.io.FORBIDDEN;

    if (mod_notes_edit_max_time !== 0 &&
      env.data.note.ts < Date.now() - mod_notes_edit_max_time * 60 * 1000) {
      throw {
        code: N.io.CLIENT_ERROR,
        message: env.t('err_perm_expired')
      };
    }
  });


  // Delete note
  //
  N.wire.on(apiPath, async function delete_note(env) {
    await N.models.users.ModeratorNote.deleteOne({ _id: env.data.note._id });
  });
};
