// Update album


'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    album_id:     { format: 'mongo', required: true },
    title:        { type: 'string',  required: true, minLength: 1 },
    description:  { type: 'string',  required: true },
    cover_id:     { format: 'mongo' }
  });


  // Fetch album info
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
    var mTypes = N.models.users.MediaInfo.types;

    // Skip if cover_id isn't set
    if (!env.params.cover_id) {
      callback();
      return;
    }

    N.models.users.MediaInfo
        .findOne({
          media_id: env.params.cover_id,
          type: mTypes.IMAGE,
          album_id: env.data.album._id
        })
        .lean(true)
        .exec(function (err, cover) {

      if (err) {
        callback(err);
        return;
      }

      // On invalid cover just leave existing intact.
      // That's more simple than process errors for very rare case.
      if (cover) {
        env.data.cover = cover;
      }

      callback();
    });
  });


  // Check permissions
  //
  N.wire.before(apiPath, function check_permissions(env) {
    var album = env.data.album;

    if (env.user_info.user_id !== String(album.user_id)) {
      return N.io.FORBIDDEN;
    }
  });


  // Update album info
  //
  N.wire.on(apiPath, function update_album(env, callback) {
    var cover = env.data.cover;
    var album = env.data.album;

    var data = {
      title: env.params.title,
      description: env.params.description
    };

    if (cover) {
      data.cover_id = cover.media_id;
    }

    N.models.users.Album.update({ _id: album._id }, data, callback);
  });
};
