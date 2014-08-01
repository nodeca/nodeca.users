// Update media


'use strict';


module.exports = function (N, apiPath) {


  N.validate(apiPath, {
    media_id: { format: 'mongo', required: true },
    album_id: { format: 'mongo', required: true }
  });


  // Fetch media
  //
  N.wire.before(apiPath, function fetch_media (env, callback) {
    N.models.users.Media.findOne({ _id: env.params.media_id, exists: true }).lean(true).exec(function (err, media) {
      if (err) {
        callback(err);
        return;
      }

      if (!media) {
        callback(N.io.NOT_FOUND);
        return;
      }

      // Check media owner
      if (!env.session.user_id || media.user_id.toString() !== env.session.user_id.toString()) {
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
      if (!env.session.user_id || album.user_id.toString() !== env.session.user_id.toString()) {
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

    N.models.users.Media.update({ _id: media._id }, { album_id: album._id }, callback);
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
