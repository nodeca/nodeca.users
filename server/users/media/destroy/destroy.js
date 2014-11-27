// Delete media


'use strict';

var Mongoose = require('mongoose');


module.exports = function (N, apiPath) {


  N.validate(apiPath, {
    media_id: { format: 'mongo', required: true },
    restore:  { type: 'boolean' }
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
        if (env.session.user_id !== String(media.user_id)) {
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
    if (!env.params.restore) {
      callback();
      return;
    }

    var mTypes = N.models.users.MediaInfo.types;
    var totalSize;

    // Fetch user's total media size
    //
    // TODO: Aggregation $groups can't use coverage index.
    // TODO: All user's medias will be selected to calculate $sum. Check performance on production
    N.models.users.MediaInfo.aggregate(
      [
        {
          $match: {
            user_id: new Mongoose.Types.ObjectId(env.session.user_id),
            type: { $in: mTypes.LIST_VISIBLE }
          }
        },
        { $group: { _id: null, total_size: { $sum: '$file_size' } } }
      ],
      function (err, data) {

        if (err) {
          callback(err);
          return;
        }

        totalSize = data[0] ? data[0].total_size : 0;

        env.extras.settings.fetch('users_media_total_quota_mb', function (err, users_media_total_quota_mb) {

          if (err) {
            callback(err);
            return;
          }

          if (users_media_total_quota_mb * 1024 * 1024 < totalSize) {
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
    var mTypes = N.models.users.MediaInfo.types;
    var media = env.data.media;

    /* eslint no-bitwise: 0 */
    var mType = env.params.restore ? (media.type & ~mTypes.MASK_DELETED) : (media.type | mTypes.MASK_DELETED);

    N.models.users.MediaInfo.update({ _id: media._id }, { type: mType }, function (err) {
      if (err) {
        callback(err);
        return;
      }

      callback();
    });
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
