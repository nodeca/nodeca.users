// Fetch albums list


'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid: {
      type: 'integer',
      minimum: 1,
      required: true
    }
  });


  // Fetch owner
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env) {
    return N.wire.emit('internal:users.fetch_user_by_hid', env);
  });


  // Find and processes user albums
  //
  N.wire.on(apiPath, function* get_user_albums(env) {
    env.res.albums = yield N.models.users.Album
                              .find({ user_id: env.data.user._id })
                              .sort('-default -last_ts')
                              .lean(true);

    // For check is user owner
    env.res.user_hid = env.data.user.hid;
  });
};
