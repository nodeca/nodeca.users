// Create video to album
//
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    album_id: { format: 'mongo', required: true },
    media_url: { type: 'string', required: true }
  });


  // Fetch album info (by album_id)
  //
  N.wire.before(apiPath, function* fetch_album(env) {
    let album = yield N.models.users.Album
                          .findOne({ _id: env.params.album_id })
                          .lean(true);

    if (!album) {
      throw N.io.NOT_FOUND;
    }

    env.data.album = album;
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
    let data = {};

    N.wire.emit('internal:users.album.init_embedza', data, function (err) {
      if (err) {
        callback(err);
        return;
      }

      // Get thumb url
      data.embedza.render(env.params.media_url, 'thumb_url', function (err, thumb) {
        if (err) {
          callback({ code: N.io.CLIENT_ERROR, message: env.t('err_cannot_parse') });
          return;
        }

        if (!thumb) {
          callback({ code: N.io.CLIENT_ERROR, message: env.t('err_invalid_url') });
          return;
        }

        // Get video
        data.embedza.render(env.params.media_url, 'block', function (err, block) {
          if (err) {
            callback({ code: N.io.CLIENT_ERROR, message: env.t('err_cannot_parse') });
            return;
          }

          if (!block) {
            callback({ code: N.io.CLIENT_ERROR, message: env.t('err_invalid_url') });
            return;
          }

          let media = new N.models.users.MediaInfo();

          media.medialink_html = block.html;
          media.medialink_meta = { thumb: thumb.html };
          media.user_id = env.data.album.user_id;
          media.album_id = env.data.album._id;
          media.type = N.models.users.MediaInfo.types.MEDIALINK;

          // In case of medialink, we have no file, but we should specify file_id for media page
          media.media_id = media._id;

          env.res.media = media;

          media.save(callback);
        });
      });
    });
  });


  // Update album info
  //
  N.wire.after(apiPath, function* update_album_info(env) {
    yield N.models.users.Album.updateInfo(env.data.album._id);
  });
};
