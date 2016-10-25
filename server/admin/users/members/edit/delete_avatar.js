// Delete avatar
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


  // Delete avatar
  //
  N.wire.on(apiPath, function delete_avatar(env) {
    return N.models.users.User.update({ _id: env.data.user._id }, { $unset: { avatar_id: true } });
  });


  // Remove avatar from file store
  //
  N.wire.after(apiPath, function* remove_avatar_file(env) {
    if (!env.data.user.avatar_id) return;

    yield N.models.core.File.remove(env.data.user.avatar_id, true);
  });
};
