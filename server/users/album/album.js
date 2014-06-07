// Shows album/all medias page


'use strict';


module.exports = function (N, apiPath) {

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


  // Fetch owner
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env, callback) {
    N.wire.emit('internal:users.fetch_user_by_hid', env, callback);
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
