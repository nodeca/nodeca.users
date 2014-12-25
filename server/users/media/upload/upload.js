// Upload media handler for uploading files via POST request
//

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
    album_id: { format: 'mongo' }
  });


  // Fetch album info (by album_id). Fetch default album if album_id not specified
  //
  N.wire.before(apiPath, function fetch_album(env, callback) {

    var queryParams = env.params.album_id ?
                      { _id: env.params.album_id, user_id: env.session.user_id } :
                      { user_id: env.session.user_id, default: true };

    N.models.users.Album
      .findOne(queryParams)
      .lean(true)
      .exec(function (err, album) {
        if (err) {
          callback(err);
          return;
        }

        if (!album) {
          callback({
            code:    N.io.CLIENT_ERROR,
            message: env.t('err_album_not_found')
          });
          return;
        }

        env.data.album = album;
        callback();
      });
  });


  // Check permissions
  //
  N.wire.before(apiPath, function check_permissions(env, callback) {

    env.extras.settings.fetch('users_can_upload_media', function (err, users_can_upload_media) {

      if (err) {
        callback(err);
        return;
      }

      if (!users_can_upload_media) {
        callback({
          code:    N.io.CLIENT_ERROR,
          message: env.t('err_permission')
        });
        return;
      }

      callback();
    });
  });


  // Check file size early by header and terminate immediately for big uploads
  //
  N.wire.before(apiPath, function check_file_size(env, callback) {
    // `Content-Length` = (files + wrappers) + (params + wrappers)
    //
    // When single big file sent, `Content-Length` ~ FileSize.
    // Difference is < 200 bytes.
    var size = env.origin.req.headers['content-length'];

    if (!size) {
      callback(N.io.LENGTH_REQUIRED);
      return;
    }

    env.extras.settings.fetch('users_media_single_quota_kb', function (err, users_media_single_quota_kb) {

      if (err) {
        callback(err);
        return;
      }

      if (size > users_media_single_quota_kb * 1024) {
        callback({
          code:    N.io.CLIENT_ERROR,
          message: env.t('err_file_size', { max_size_kb: users_media_single_quota_kb })
        });
        return;
      }

      callback();
    });
  });


  // Check quota
  //
  N.wire.before(apiPath, function check_quota(env, callback) {
    N.models.users.UserExtra
      .findOne({ user_id: env.session.user_id })
      .select('media_size')
      .lean(true)
      .exec(function (err, extra) {
        if (err) {
          callback(err);
          return;
        }

        env.extras.settings.fetch('users_media_total_quota_mb', function (err, users_media_total_quota_mb) {

          if (err) {
            callback(err);
            return;
          }

          if (users_media_total_quota_mb * 1024 * 1024 < extra.media_size) {
            callback({
              code:    N.io.CLIENT_ERROR,
              message: env.t('err_quota_exceeded', { quota_mb: users_media_total_quota_mb })
            });
            return;
          }

          callback();
        });
      });
  });


  // Fetch post body with files via formidable
  //
  N.wire.before(apiPath, function upload_media(env, callback) {
    var form = new formidable.IncomingForm();
    form.uploadDir = tmpDir;

    form.on('progress', function (bytesReceived, contentLength) {

      // Terminate connection if `Content-Length` header is fake
      if (bytesReceived > contentLength) {
        form._error(new Error('Data size too big (should be equal to Content-Length)'));
      }
    });

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

    N.models.users.MediaInfo.createFile({
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

        env.res.media = media;
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

    var mTypes = N.models.users.MediaInfo.types;
    var media = env.data.media;

    if (media.type !== mTypes.IMAGE) {
      callback();
      return;
    }

    N.models.users.Album.update({ _id: env.data.album._id }, { cover_id: media.media_id }, callback);
  });
};
