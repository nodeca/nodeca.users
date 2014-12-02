// Fetch media list


'use strict';

module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    album_id: { format: 'mongo', required: true }
  });


  // Find and processes user media
  //
  N.wire.on(apiPath, function get_user_medias(env, callback) {
    var mTypes = N.models.users.MediaInfo.types;

    N.models.users.MediaInfo
      .find({ type: mTypes.IMAGE, album_id: env.params.album_id })
      .lean(true)
      .sort('-media_id')
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
