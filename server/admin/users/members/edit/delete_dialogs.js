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
  N.wire.on(apiPath, function* delete_dialogs(env) {
    yield N.models.users.Dialog.update(
      { user: env.data.user._id },
      { $set: { exists: false } },
      { multi: true }
    );

    yield N.models.users.Dialog.update(
      { to: env.data.user._id },
      { $set: { exists: false } },
      { multi: true }
    );
  });
};
