// Update media


'use strict';


module.exports = function (N, apiPath) {


  N.validate(apiPath, {
    media_id: { format: 'mongo', required: true },
    album_id: { format: 'mongo', required: true }
  });


  // Fetch media
  //
  N.wire.before(apiPath, function fetch_media(env, callback) {
    var mTypes = N.models.users.MediaInfo.types;

    N.models.users.MediaInfo
      .findOne({ media_id: env.params.media_id, type: { $in: mTypes.LIST_VISIBLE } })
      .lean(true)
      .exec(function (err, media) {
        if (err) {
          callback(err);
          return;
        }

        if (!media) {
          callback(N.io.NOT_FOUND);
          return;
        }

        // Check media owner
        if (env.user_info.user_id !== String(media.user_id)) {
          callback(N.io.FORBIDDEN);
          return;
        }

        env.data.media = media;
        callback();
      });
  });


  // Fetch album
  //
  N.wire.before(apiPath, function fetch_album(env, callback) {

    N.models.users.Album.findOne({ _id: env.params.album_id }).lean(true).exec(function (err, album) {
      if (err) {
        callback(err);
        return;
      }

      if (!album) {
        callback(N.io.NOT_FOUND);
        return;
      }

      // Check album owner
      if (env.user_info.user_id !== String(album.user_id)) {
        callback(N.io.FORBIDDEN);
        return;
      }

      env.data.album = album;
      callback();
    });
  });


  // Update media
  //
  N.wire.on(apiPath, function update_media(env, callback) {
    var media = env.data.media;
    var album = env.data.album;

    if (album._id.toString() === media.album_id.toString()) {
      // Album not changed
      callback();
      return;
    }

    N.models.users.MediaInfo.update({ _id: media._id }, { album_id: album._id }, callback);
  });


  // Update old and new album if changed
  //
  N.wire.after(apiPath, function update_albums(env, callback) {
    var media = env.data.media;
    var album = env.data.album;

    if (album._id.toString() === media.album_id.toString()) {
      // Album not changed
      callback();
      return;
    }

    // Full update old album
    N.models.users.Album.updateInfo(media.album_id, true, function (err) {
      if (err) {
        callback(err);
        return;
      }

      // Update new album (increment count)
      N.models.users.Album.updateInfo(album._id, callback);
    });
  });
};
