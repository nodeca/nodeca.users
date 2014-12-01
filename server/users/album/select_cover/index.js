// Fetch media list


'use strict';

module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid: { type: 'integer', minimum: 1, required: true },
    album_id: { format: 'mongo' }
  });


  // Fetch user
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env, callback) {
    N.wire.emit('internal:users.fetch_user_by_hid', env, callback);
  });


  // Find and processes user media
  //
  N.wire.on(apiPath, function get_user_medias(env, callback) {
    var mTypes = N.models.users.MediaInfo.types;

    N.models.users.MediaInfo
      .find({ user_id: env.data.user._id, type: mTypes.IMAGE, album_id: env.params.album_id })
      .lean(true)
      .sort('-ts')
      .exec(function (err, medias) {
        if (err) {
          callback(err);
          return;
        }

        env.res.medias = medias;
        callback();
      });
  });
};
