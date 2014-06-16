// Upload media


'use strict';


var formidable = require('formidable');
var tmpDir = require('os').tmpdir();
var fs = require('fs');
var async = require('async');
var numCPUs = require('os').cpus().length;


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    user_hid: {
      type: 'integer',
      minimum: 1,
      required: true
    },
    album_id: {
      format: 'mongo',
      required: true
    }
  });


  // Delete files in array
  //
  var unlinkFiles = function (files, callback) {
    async.each(files, function (file, next) {
      fs.unlink(file.path, next);
    }, callback);
  };


  // Delete medias from DB
  //
  var removeMedias = function (medias, callback) {
    async.each(medias, function (media, next) {
      media.remove(next);
    }, callback);
  };


  // Fetch owner by hid
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env, callback) {
    N.wire.emit('internal:users.fetch_user_by_hid', env, callback);
  });


  // Fetch album info (by album_id)
  //
  N.wire.before(apiPath, function fetch_album(env, callback) {
    N.models.users.Album
      .findOne({ '_id': env.params.album_id })
      .lean(true)
      .exec(function (err, album) {
        if (err) { return callback(err); }

        if (!album) {
          callback(N.io.NOT_FOUND);
          return;
        }

        env.data.album = album;
        callback();
      });
  });


  // Check permissions
  //
  N.wire.before(apiPath, function check_permissions(env, callback) {
    // TODO: check quota
    // TODO: check permissions

    // Wrong member_hid parameter
    if (env.data.user._id.toString() !== env.data.album.user_id.toString()) {
      callback(N.io.NOT_FOUND);
      return;
    }

    // Check is current user owner of album
    if (env.user_info.is_guest || env.session.user_id.toString() !== env.data.album.user_id.toString()) {
      callback(N.io.NOT_AUTHORIZED);
      return;
    }

    callback();
  });


  // Upload files via formidable
  //
  N.wire.on(apiPath, function upload_media(env, callback) {
    var files = [];

    var form = new formidable.IncomingForm();

    form.uploadDir = tmpDir;
    form.on('file', function (name, file) {
      // Check file type
      if (N.config.options.users.media_uploads.allowed_types.indexOf(file.type) < 0) {
        // Type incorrect - skip file
        fs.unlink(file.path);
        return;
      }

      // Check file size
      if (N.config.options.users.media_uploads.max_size_kb < (file.size / 1024)) { // file.size in bytes
        // Size incorrect - skip file
        fs.unlink(file.path);
        return;
      }

      files.push(file);

    }).on('aborted', function () {

      env.data.upload_files = files;
      env.data.upload_success = false;
      callback();

    }).on('error', function (e) {

      unlinkFiles(files, function () {
        callback(e);
      });
    }).on('end', function () {

      env.data.upload_files = files;
      env.data.upload_success = true;
      callback();

    }).parse(env.origin.req);

  });


  // Create previews and save
  //
  N.wire.after(apiPath, function prepare_media(env, callback) {
    var Media = N.models.users.Media;
    var Album = N.models.users.Album;
    var files = env.data.upload_files;
    var medias = [];

    // User abort
    if (!env.data.upload_success) {
      unlinkFiles(files, callback);
      return;
    }

    async.eachLimit(files, numCPUs, function (file, next) {
      Media.createImage(file.path, function (err, fileId) {
        if (err) { return next(err); }

        var media = new Media();
        media.user_id = env.session.user_id;
        media.album_id = env.data.album._id;
        media.created_at = new Date();
        media.file_id = fileId;
        media.save(function (err) {
          if (err) { return next(err); }

          medias.push(media);
          next();
        });
      });
    }, function (err) {
      unlinkFiles(files, function () {
        if (err) {
          // Try to clean up dirty data on error
          removeMedias(medias, function () {
            callback(err);
          });
          return;
        }

        Album.updateInfo(env.data.album._id, function (err) {
          if (err) {
            // Try to clean up dirty data on error
            removeMedias(medias, function () {
              callback(err);
            });
            return;
          }

          callback();
        });
      });
    });
  });
};
