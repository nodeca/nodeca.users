// Shows album/all medias page


'use strict';


module.exports = function (N, apiPath) {
  var User = N.models.users.User;

  N.validate(apiPath, {
    user_hid: {
      type: 'integer',
      minimum: 1,
      required: true
    },
    album_id: {
      format: 'mongo'
    }
  });


  // Fetch album owner by 'hid'
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env, callback) {
    User
      .findOne({ 'hid': env.params.user_hid })
      .lean(true)
      .exec(function (err, user) {
        if (err) {
          callback(err);
          return;
        }

        // TODO: add permissions to view deleted users
        if (!user || !user.exists) {
          callback(N.io.NOT_FOUND);
          return;
        }

        env.res.user_hid = user.hid;
        env.data.user = user;
        callback();
      });
  });


  N.wire.on(apiPath, function get_user_albums(env, callback) {
    if (!env.params.album_id) {
      // TODO: show all photos for user (env.data.user)
      return callback();
    }

    // TODO: show all photos for album by album_id
    callback();

  });
};
