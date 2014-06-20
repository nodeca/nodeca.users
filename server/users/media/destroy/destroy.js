// Delete media


'use strict';


module.exports = function (N, apiPath) {


  N.validate(apiPath, {
    media_id: {
      format: 'mongo',
      required: true
    }
  });


  N.wire.before(apiPath, function fetch_user_media (env, callback) {
    if (env.user_info.is_guest) {
      callback(N.io.NOT_AUTHORIZED);
      return;
    }

    N.models.users.Media.findOne({ '_id': env.params.media_id }).exec(function (err, media) {
      if (err) {
        callback(err);
        return;
      }

      if (!media) {
        callback(N.io.NOT_FOUND);
        return;
      }

      // Check media owner
      if (media.user_id.toString() !== env.session.user_id.toString()) {
        callback(N.io.NOT_AUTHORIZED);
        return;
      }

      env.data.media = media;
      callback();
    });
  });


  // Delete media by id
  //
  N.wire.on(apiPath, function delete_media(env, callback) {
    var media = env.data.media;

    media.remove(function (err) {
      if (err) {
        callback(err);
        return;
      }

      // After delete media update album cover and date
      N.models.users.Album.updateInfo(media.album_id, function (err) {
        if (err) {
          callback(err);
          return;
        }

        callback();
      });
    });
  });
};
