// Delete/restore account
//

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    user_hid: { type: 'integer', minimum: 1, required: true },
    delete: { type: 'boolean', required: true }
  });


  // Fetch member by 'user_hid'
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env) {
    return N.wire.emit('internal:users.fetch_user_by_hid', env);
  });


  // Delete account
  //
  N.wire.on(apiPath, function delete_account(env) {
    return N.models.users.User.updateOne({ _id: env.data.user._id }, { $set: { exists: !env.params.delete } });
  });
};
