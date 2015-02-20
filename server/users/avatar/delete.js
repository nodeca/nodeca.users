// Delete avatar
//


'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {});


  // Check permissions
  //
  N.wire.before(apiPath, function check_permissions(env, callback) {

    // Check is current user owner of album
    if (env.session.is_guest) {
      callback(N.io.FORBIDDEN);
      return;
    }

    callback();
  });


  // Fetch user
  //
  N.wire.before(apiPath, function fetch_user(env, callback) {
    N.models.users.User.findOne({ _id: env.user_info.user_id }).lean(true).exec(function (err, user) {
      if (err) {
        callback(err);
        return;
      }

      if (!user) {
        callback(N.io.NOT_FOUND);
        return;
      }

      env.data.user = user;
      env.res.avatar_id = user.avatar_fallback;
      callback();
    });
  });


  // Remove avatar
  //
  N.wire.on(apiPath, function remove_avatar(env, callback) {
    N.models.users.User.update({ _id: env.data.user._id }, { avatar_id: null }, callback);
  });


  // Remove avatar from file store
  //
  N.wire.after(apiPath, function remove_avatar_file(env, callback) {
    if (!env.data.user.avatar_id) {
      callback();
      return;
    }

    N.models.core.File.remove(env.data.user.avatar_id, true, callback);
  });
};
