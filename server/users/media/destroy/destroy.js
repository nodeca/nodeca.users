// Delete media


'use strict';


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
