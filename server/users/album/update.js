// Update album


'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    album_id: { format: 'mongo', required: true },
    title: { type: 'string', minLength: 1, required: true },
    cover_id: { format: 'mongo', required: true }
  });


  // Fetch album info
  //
  N.wire.before(apiPath, function fetch_album(env, callback) {
    N.models.users.Album
      .findOne({ '_id': env.params.album_id })
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

        // No one can edit default album
        if (album.default) {
          callback(N.io.NOT_FOUND);
        }

        env.data.album = album;
        callback();
      });
  });


  // Fetch cover
  //
  N.wire.before(apiPath, function fetch_cover(env, callback) {
    N.models.users.Media.findOne({ 'file_id': env.params.cover_id }).lean(true).exec(function (err, cover) {
      if (err) {
        callback(err);
        return;
      }

      if (!cover) {
        callback(N.io.NOT_FOUND);
        return;
      }

      // Cover must be from same album
      if (cover.album_id.toString() !== env.data.album._id.toString()) {
        callback(N.io.NOT_FOUND);
        return;
      }

      env.data.cover = cover;
      callback();
    });
  });


  // Check permissions
  //
  N.wire.before(apiPath, function check_permissions(env) {
    var album = env.data.album;

    if (!env.session.user_id || env.session.user_id.toString() !== album.user_id.toString()) {
      return N.io.FORBIDDEN;
    }
  });


  // Update album info
  //
  N.wire.on(apiPath, function update_album(env, callback) {
    var cover = env.data.cover;
    var album = env.data.album;

    N.models.users.Album.update(
      { _id: album._id },
      { cover_id: cover.file_id, title: env.params.title, last_ts: Date.now() },
      callback
    );
  });
};
