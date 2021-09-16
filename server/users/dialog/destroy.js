// Remove dialog by _id
//
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    dialog_id: { format: 'mongo', required: true }
  });


  // Check user permission
  //
  N.wire.before(apiPath, function check_permissions(env) {
    if (!env.user_info.is_member) return N.io.NOT_FOUND;
  });


  // Fetch dialog
  //
  N.wire.before(apiPath, async function fetch_dialog(env) {
    env.data.dialog = await N.models.users.Dialog.findOne()
                                .where('_id').equals(env.params.dialog_id)
                                .where('exists').equals(true)
                                .where('user').equals(env.user_info.user_id) // check owner
                                .lean(true);

    if (!env.data.dialog) throw N.io.NOT_FOUND;
  });


  // Remove dialog and messages
  //
  N.wire.on(apiPath, async function remove_dialog_and_messages(env) {
    // Remove messages
    await N.models.users.DlgMessage.updateMany({ parent: env.data.dialog._id }, { exists: false });

    // Remove dialog
    await N.models.users.Dialog.updateSummary(env.data.dialog._id);
  });


  // Fill pagination (progress)
  //
  N.wire.after(apiPath, async function fill_pagination(env) {
    env.res.dialog_count = await N.models.users.Dialog
                                    .where('user').equals(env.user_info.user_id)
                                    .where('exists').equals(true)
                                    .countDocuments();
  });
};
