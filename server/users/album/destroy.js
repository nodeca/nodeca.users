// Delete album


'use strict';


var async = require('async');
var numCPUs = require('os').cpus().length;

module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    album_id: {
      format: 'mongo',
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

    if (env.session.user_id !== String(album.user_id)) {
      return N.io.FORBIDDEN;
    }
  });


  // Fetch album media
  //
  N.wire.before(apiPath, function fetch_media(env, callback) {
    N.models.users.MediaInfo
      .find({ 'album_id': env.data.album._id })
      .lean(false) // Use as mongoose model
      .exec(function (err, medias) {
        if (err) {
          callback(err);
          return;
        }
        env.data.album_media = medias;
        callback();
      });
  });


  // Delete album with all photos
  //
  N.wire.on(apiPath, function delete_album(env, callback) {
    async.eachLimit(env.data.album_media, numCPUs, function (media, next) {
      process.nextTick(function () {
        media.remove(next);
      });
    }, function (err) {
      if (err) {
        callback(err);
        return;
      }
      env.data.album.remove(callback);
    });
  });
};
