// Delete avatar
//


'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {});


  // Check permissions
  //
  N.wire.before(apiPath, function check_permissions(env) {
    if (!env.user_info.is_member) throw N.io.FORBIDDEN;
  });


  // Fetch user
  //
  N.wire.before(apiPath, async function fetch_user(env) {
    env.data.user = await N.models.users.User
                              .findOne({ _id: env.user_info.user_id })
                              .lean(true);

    if (!env.data.user) throw N.io.NOT_FOUND;

    env.res.avatar_id = null;
  });


  // Remove avatar
  //
  N.wire.on(apiPath, async function remove_avatar(env) {
    await N.models.users.User.updateOne({ _id: env.data.user._id }, { $unset: { avatar_id: true } });
  });


  // Remove avatar from file store
  //
  N.wire.after(apiPath, async function remove_avatar_file(env) {
    if (!env.data.user.avatar_id) return;

    await N.models.core.File.remove(env.data.user.avatar_id, true);
  });
};
