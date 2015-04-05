// Create video to album

'use strict';

module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    album_id: { format: 'mongo', required: true },
    media_url: { type: 'string', required: true }
  });


  // Fetch album info (by album_id)
  //
  N.wire.before(apiPath, function fetch_album(env, callback) {
    N.models.users.Album
      .findOne({ _id: env.params.album_id })
      .lean(true)
      .exec(function (err, album) {
        if (err) {
          callback(err);
          return;
        }

        if (!album) {
          callback(N.io.NOT_FOUND);
          return;
        }

        env.data.album = album;
        callback();
      });
  });


  // Check is current user owner of album
  //
  N.wire.before(apiPath, function check_permissions(env) {
    if (env.user_info.user_id !== String(env.data.album.user_id)) {
      return N.io.FORBIDDEN;
    }
  });


  // Create media by media_url
  //
  N.wire.on(apiPath, function create_media(env, callback) {
    N.medialinker('albums').render(env.params.media_url, function (err, result) {
      if (err) {
        callback({ code: N.io.CLIENT_ERROR, message: env.t('err_cannot_parse') });
        return;
      }

      if (!result) {
        callback({ code: N.io.CLIENT_ERROR, message: env.t('err_invalid_url') });
        return;
      }

      var media = new N.models.users.MediaInfo();
      media.medialink_html = result.html;
      media.medialink_meta = result.meta;
      media.user_id = env.data.album.user_id;
      media.album_id = env.data.album._id;
      media.type = N.models.users.MediaInfo.types.MEDIALINK;

      // In case of medialink, we have no file, but we should specify file_id for media page
      media.media_id = media._id;

      env.res.media = media;

      media.save(callback);
    });
  });


  // Update album info
  //
  N.wire.after(apiPath, function update_album_info(env, callback) {

    N.models.users.Album.updateInfo(env.data.album._id, function (err) {
      if (err) {
        callback(err);
        return;
      }

      callback();
    });
  });
};
