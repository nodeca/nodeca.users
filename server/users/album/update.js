// Show album edit form


'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    album_id: {
      format: 'mongo',
      required: true
    },
    title: {
      type: 'string',
      minLength: 1,
      required: true
    }
  });


  // Fetch album info
  //
  N.wire.before(apiPath, function fetch_album(env, callback) {
    N.models.users.Album
      .findOne({ '_id': env.params.album_id })
      .lean(false) // Use as mongoose model
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


  // Check permissions
  //
  N.wire.before(apiPath, function check_permissions(env) {
    var album = env.data.album;

    if (env.user_info.is_guest) {
      return N.io.NOT_AUTHORIZED;
    }

    if (env.session.user_id.toString() !== album.user_id.toString()) {
      return N.io.NOT_AUTHORIZED; // Forbidden
    }
  });


  // Update album info
  //
  N.wire.on(apiPath, function update_album(env, callback) {
    var album = env.data.album;
    album.title = env.params.title;
    album.last_at = new Date();
    album.save(callback);
  });
};
