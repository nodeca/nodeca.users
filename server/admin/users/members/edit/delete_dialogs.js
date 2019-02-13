// Delete dialogs associated with an account
//

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    user_hid: { type: 'integer', minimum: 1, required: true }
  });


  // Fetch member by 'user_hid'
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env) {
    return N.wire.emit('internal:users.fetch_user_by_hid', env);
  });


  // Delete dialogs
  //
  N.wire.on(apiPath, async function delete_dialogs(env) {
    await N.models.users.Dialog.updateMany(
      { user: env.data.user._id },
      { $set: { exists: false } }
    );

    await N.models.users.Dialog.updateMany(
      { to: env.data.user._id },
      { $set: { exists: false } }
    );
  });
};
