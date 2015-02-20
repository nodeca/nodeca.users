// Delete media


'use strict';


module.exports = function (N, apiPath) {


  N.validate(apiPath, {
    media_id: { format: 'mongo', required: true },
    revert:  { type: 'boolean' }
  });


  N.wire.before(apiPath, function fetch_user_media (env, callback) {
    N.models.users.MediaInfo
      .findOne({ media_id: env.params.media_id })
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


  // Check quota
  //
  N.wire.before(apiPath, function check_quota(env, callback) {
    // Check quota only on restore media
    if (!env.params.revert) {
      callback();
      return;
    }

    N.models.users.UserExtra
      .findOne({ user_id: env.user_info.user_id })
      .select('media_size')
      .lean(true)
      .exec(function (err, extra) {
        if (err) {
          callback(err);
          return;
        }

        env.extras.settings.fetch('users_media_total_quota_mb', function (err, users_media_total_quota_mb) {

          if (err) {
            callback(err);
            return;
          }

          if (users_media_total_quota_mb * 1024 * 1024 < extra.media_size) {
            callback({
              code:    N.io.CLIENT_ERROR,
              message: env.t('err_quota_exceeded', { quota_mb: users_media_total_quota_mb })
            });
            return;
          }

          callback();
        });
      });
  });


  // Delete media by id
  //
  N.wire.on(apiPath, function delete_media(env, callback) {
    N.models.users.MediaInfo.markDeleted(env.data.media.media_id, env.params.revert, callback);
  });


  // Update album info
  //
  N.wire.after(apiPath, function update_album(env, callback) {

    N.models.users.Album.updateInfo(env.data.media.album_id, true, function (err) {
      if (err) {
        callback(err);
        return;
      }

      callback();
    });
  });
};
