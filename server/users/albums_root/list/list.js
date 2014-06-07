// Shows albums list for user by hid
'use strict';

module.exports = function (N, apiPath) {
  var Album = N.models.users.Album;
  var User = N.models.users.User;

  N.validate(apiPath, {
    user_hid: {
      type: 'integer',
      minimum: 1,
      required: true
    }
  });

  // Fetch album owner by 'hid'
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env, callback) {
    // If user already loaded - do nothing
    if (env.data.user) { return callback(); }

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

        env.data.user = user;
        callback();
      });
  });


  // Find and processes user albums
  //
  N.wire.on(apiPath, function get_user_albums(env, callback) {
    Album
      .find({ 'user_id': env.data.user._id })
      .sort('-default -last_at')
      .lean(true)
      .exec(function (err, result) {
        if (err) {
          callback(err);
          return;
        }

        // For check is user owner
        env.res.user_hid = env.data.user.hid;

        env.res.albums = result;
        callback();
      });
  });
};
