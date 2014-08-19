// Upload media


'use strict';


var formidable  = require('formidable');
var tmpDir      = require('os').tmpdir();
var fs          = require('fs');
var async       = require('async');
var _           = require('lodash');
var mimoza      = require('mimoza');
var resizeParse = require('../../../_lib/resize_parse');


module.exports = function (N, apiPath) {

  var config = resizeParse(N.config.users.uploads);

  // CSRF comes in post data and checked separately
  N.validate(apiPath, {
    album_id: { format: 'mongo', required: true }
  });


  // Fetch album info (by album_id)
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

        env.data.album = album;
        callback();
      });
  });


  // Check permissions
  //
  N.wire.before(apiPath, function check_permissions(env, callback) {
    // TODO: check quota and permissions

    // Check is current user owner of album
    if (env.session.user_id !== env.data.album.user_id.toString()) {
      callback(N.io.FORBIDDEN);
      return;
    }

    callback();
  });


  // Fetch post body with files via formidable
  //
  N.wire.before(apiPath, function upload_media(env, callback) {
    var form = new formidable.IncomingForm();
    form.uploadDir = tmpDir;

    form.parse(env.origin.req, function (err, fields, files) {
      files = _.toArray(files);

      function fail(err) {
        async.each(_.pluck(files, 'path'), function (path, next) {
          fs.unlink(path, next);
        }, function () {
          // Don't care unlink result, forward previous error
          callback(err);
        });
      }

      // In this callback also will be 'aborted' error
      if (err) {
        fail(err);
        return;
      }

      // Check CSRF
      if (!env.session.csrf || !fields.csrf || (env.session.csrf !== fields.csrf)) {
        fail({
          code: N.io.INVALID_CSRF_TOKEN,
          data: { token: env.session.csrf }
        });
        return;
      }

      // Should never happens - uploader send only one file
      if (files.length !== 1) {
        fail(new Error('Only one file allowed on single upload request'));
        return;
      }

      var fileInfo = files[0];

      // Usually file size and type are checked on client side,
      // but we must check it on server side for security reasons
      var allowedTypes = _.map(config.extentions, function (ext) {
        return mimoza.getMimeType(ext);
      });

      if (allowedTypes.indexOf(fileInfo.type) === -1) {
        fail(new Error('Wrong file type on upload'));
        return;
      }

      env.data.upload_file_info = fileInfo;
      callback();
    });
  });


  // Create image/binary (for images previews created automatically)
  //
  N.wire.on(apiPath, function save_media(env, callback) {
    var fileInfo = env.data.upload_file_info;

    N.models.users.Media.createFile({
      album_id: env.data.album._id,
      user_id: env.session.user_id,
      path: fileInfo.path,
      name: fileInfo.name,
      // In case of blob fileInfo.name will be 'blob'.
      // Get extension from fileInfo.type.
      ext: fileInfo.type.split('/').pop()
    }, function (err, media) {
      // Remove file anyway after upload to gridfs
      fs.unlink(fileInfo.path, function () {

        if (err) {
          callback(err);
          return;
        }

        env.data.media = media;
        callback();
      });
    });
  });


  // Update album info
  //
  N.wire.after(apiPath, function update_album_info(env, callback) {

    N.models.users.Album.updateInfo(env.data.album._id, function (err) {
      if (err) {
        callback(err);
        return;
      }

      callback();
    });
  });


  // Update cover for default album
  //
  N.wire.after(apiPath, function update_default(env, callback) {
    if (!env.data.album.default) {
      callback();
      return;
    }

    var media = env.data.media;

    if (media.type !== 'image') {
      callback();
      return;
    }

    N.models.users.Album.update({ _id: env.data.album._id }, { cover_id: media.file_id }, callback);
  });
};
