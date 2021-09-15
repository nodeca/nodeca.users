// Remove message by _id
//
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    message_id: { format: 'mongo', required: true }
  });


  // Check user permission
  //
  N.wire.before(apiPath, function check_permissions(env) {
    if (!env.user_info.is_member) return N.io.NOT_FOUND;
  });


  // Fetch dialog and message
  //
  N.wire.before(apiPath, async function fetch_dialog(env) {
    // permission checks are inside mongodb queries:
    //  - restrict to dialog owned by current user
    //  - make sure message is visible (not deleted)
    //  - make sure dialog is visible (not deleted)
    let dlg_message = await N.models.users.DlgMessage.findOne()
                            .where('exists').equals(true)
                            .where('_id').equals(env.params.message_id)
                            .lean(true);

    if (!dlg_message) throw N.io.NOT_FOUND;

    let dialog = await N.models.users.Dialog.findOne()
                          .where('user').equals(env.user_info.user_id)
                          .where('exists').equals(true)
                          .where('_id').equals(dlg_message.parent)
                          .lean(true);

    if (!dialog) throw N.io.NOT_FOUND;

    env.data.dialog = dialog;
    env.data.dlg_message = dlg_message;
  });


  // Remove message
  //
  N.wire.on(apiPath, async function remove_message(env) {
    await N.models.users.DlgMessage.updateOne({ _id: env.data.dlg_message._id }, { exists: false });
  });


  // Update dialog cache and preview,
  // this also marks dialog as `exists: false` if no messages are left
  //
  N.wire.after(apiPath, async function update_dialog(env) {
    await N.models.users.Dialog.updateSummary(env.data.dialog._id);
  });


  // Fill pagination (progress)
  //
  N.wire.after(apiPath, async function fill_pagination(env) {
    env.res.message_count = env.data.message_count;
  });
};
