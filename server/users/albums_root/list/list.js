// Fetch albums list


'use strict';


module.exports = function (N, apiPath) {
  var Album = N.models.users.Album;


  N.validate(apiPath, {
    user_hid: {
      type: 'integer',
      minimum: 1,
      required: true
    }
  });


  // Fetch owner
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env, callback) {
    N.wire.emit('internal:users.fetch_user_by_hid', env, callback);
  });


  // Find and processes user albums
  //
  N.wire.on(apiPath, function get_user_albums(env, callback) {
    Album
      .find({ user_id: env.data.user._id })
      .sort('-default -last_ts')
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
