// Delete media


'use strict';


module.exports = function (N, apiPath) {


  N.validate(apiPath, {
    media_id: { format: 'mongo', required: true },
    restore:  { type: 'boolean' }
  });


  N.wire.before(apiPath, function fetch_user_media (env, callback) {
    N.models.users.Media.findOne({ '_id': env.params.media_id }).lean(true).exec(function (err, media) {
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


  // Delete media by id
  //
  N.wire.on(apiPath, function delete_media(env, callback) {
    var media = env.data.media;

    var exists = env.params.restore ? true : false;
    N.models.users.Media.update({ _id: media._id }, { exists: exists }, function (err) {
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
