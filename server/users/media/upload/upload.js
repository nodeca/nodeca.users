// Upload media


'use strict';


var formidable = require('formidable');
var tmpDir = require('os').tmpdir();
var fs = require('fs');
var async = require('async');

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

    if (env.user_info.is_guest) {
      callback(N.io.NOT_AUTHORIZED);
      return;
    }

    // Check is current user owner of album
    if (env.session.user_id.toString() !== env.data.album.user_id.toString()) {
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
    form.on('fileBegin', function (name, file) {

      // TODO: check file.type and unlink wrong
      files.push(file);

    }).on('aborted', function () {

      env.data.files = files;
      env.data.success = false;
      callback();

    }).on('error', function (e) {

      files.forEach(function (file) {
        fs.unlink(file.path);
      });
      callback(e);

    }).on('end', function () {

      env.data.files = files;
      env.data.success = true;
      callback();

    }).parse(env.origin.req);

  });


  // Create previews and save
  //
  N.wire.after(apiPath, function prepare_media(env, callback) {
    var Media = N.models.users.Media;
    var Album = N.models.users.Album;
    var files = env.data.files;
    console.log(files);

    // User abort
    if (!env.data.success) {
      files.forEach(function (file) {
        fs.unlink(file.path);
      });

      callback();
      return;
    }

    async.eachSeries(files, function (file, next) {
      Media.createImage(file.path, function (err, fileId) {
        if (err) { return next(err); }

        var media = new Media();
        media.user_id = env.session.user_id;
        media.album_id = env.data.album._id;
        media.created_at = new Date();
        media.file_id = fileId;
        media.save(next);
      });
    }, function (err) {
      if (err) {
        files.forEach(function (file) {
          fs.unlink(file.path);
        });
        callback(err);
        return;
      }

      Album.updateInfo(env.data.album._id, function () {
        if (err) { return callback(err); }

        files.forEach(function (file) {
          fs.unlink(file.path);
        });

        callback();
      });
    });
  });
};
