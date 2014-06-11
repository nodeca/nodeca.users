// Fetch media list


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


  // Find and processes user media
  //
  N.wire.on(apiPath, function get_user_medias(env, callback) {
    var query = N.models.users.Media.find().lean(true).sort('-created_at');

    // If album_id isn't set - fetch all user medias
    if (env.params.album_id) {
      query.where({ 'album_id': env.params.album_id });
    }
    query.where({ 'user_id': env.data.user._id });

    query.exec(function (err, result) {
      if (err) {
        callback(err);
        return;
      }

      // For check is user owner
      env.res.user_hid = env.data.user.hid;

      env.res.medias = result;

      callback();
    });
  });
};
