// Upload media


'use strict';


var formidable    = require('formidable');
var tmpDir        = require('os').tmpdir();
var fs            = require('fs');
var async         = require('async');
var _             = require('lodash');
var mimoza        = require('mimoza');
var configReader  = require('../../../_lib/uploads_config_reader');


module.exports = function (N, apiPath) {

  var config = configReader(((N.config.options || {}).users || {}).media || {});

  // CSRF comes in post data and checked separately
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

    // Wrong member_hid parameter
    if (env.data.user._id.toString() !== env.data.album.user_id.toString()) {
      callback(N.io.NOT_FOUND);
      return;
    }

    // Check is current user owner of album
    if (!env.session.user_id || env.session.user_id.toString() !== env.data.album.user_id.toString()) {
      callback(N.io.FORBIDDEN);
      return;
    }

    callback();
  });


  // Upload files via formidable
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


  // Create image (previews are created on save)
  //
  N.wire.on(apiPath, function save_media(env, callback) {
    var Media = N.models.users.Media;
    var fileInfo = env.data.upload_file_info;

    Media.createFile(fileInfo.path, fileInfo.type.split('/').pop(), function (err, data) {
      // Remove file anyway after upload to gridfs
      fs.unlink(fileInfo.path, function () {

        if (err) {
          callback(err);
          return;
        }

        var media = new Media();
        if (data.type === 'image') {
          media.image_sizes = data.sizes;
        }
        media.user_id = env.session.user_id;
        media.album_id = env.data.album._id;
        media.file_id = data.fileId;
        media.type = data.type;
        media.file_name = fileInfo.name || '';

        env.data.media = media;

        media.save(callback);
      });
    });
  });


  // Update album info
  //
  N.wire.after(apiPath, function update_album_info(env, callback) {
    var media = env.data.media;

    N.models.users.Album.updateInfo(env.data.album._id, function (err) {
      if (err) {
        // Remove dirty media
        media.remove(function () {
          callback(err);
        });
        return;
      }

      callback();
    });
  });
};
