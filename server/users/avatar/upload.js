// Upload avatar handler for uploading avatars via POST request
//


'use strict';


var formidable  = require('formidable');
var tmpDir      = require('os').tmpdir();
var fs          = require('fs');
var async       = require('async');
var _           = require('lodash');
var resizeParse = require('nodeca.users/server/_lib/resize_parse');
var resize      = require('nodeca.users/models/users/_lib/resize');


module.exports = function (N, apiPath) {

  var config = resizeParse(N.config.users.avatars);

  // CSRF comes in post data and checked separately
  N.validate(apiPath, {});


  // Check permissions
  //
  N.wire.before(apiPath, function check_permissions(env, callback) {
    if (env.session.is_guest) {
      callback(N.io.FORBIDDEN);
      return;
    }

    callback();
  });


  // Fetch user
  //
  N.wire.before(apiPath, function fetch_user(env, callback) {
    N.models.users.User.findOne({ _id: env.user_info.user_id }).lean(true).exec(function (err, user) {
      if (err) {
        callback(err);
        return;
      }

      if (!user) {
        callback(N.io.NOT_FOUND);
        return;
      }

      env.data.user = user;
      callback();
    });
  });


  // Check file size early by header and terminate immediately for big uploads
  //
  N.wire.before(apiPath, function check_file_size(env) {
    // `Content-Length` = (files + wrappers) + (params + wrappers)
    //
    // When single big file sent, `Content-Length` ~ FileSize.
    // Difference is < 200 bytes.
    var size = env.origin.req.headers['content-length'];

    if (!size) {
      return N.io.LENGTH_REQUIRED;
    }

    if (size > 1 * 1024 * 1024) { // Don't allow > 1 MB
      // It should never happen, because avatar already resized on client side
      return N.io.FORBIDDEN;
    }
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
        async.each(_.map(files, 'path'), function (path, next) {
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
      if (!env.session.token_csrf || !fields.csrf || (env.session.token_csrf !== fields.csrf)) {
        fail({
          code: N.io.INVALID_CSRF_TOKEN,
          data: { token: env.session.token_csrf }
        });
        return;
      }

      // Should never happens - uploader send only one file
      if (files.length !== 1) {
        fail(new Error('Only one file allowed on single upload request'));
        return;
      }

      env.data.upload_file_info = files[0];
      callback();
    });
  });


  // Create image/binary (for images previews created automatically)
  //
  N.wire.on(apiPath, function save_media(env, callback) {
    var fileInfo = env.data.upload_file_info;
    var ext = fileInfo.type.split('/').pop();
    var typeConfig = config.types[ext];

    if (!typeConfig) {
      fs.unlink(fileInfo.path, function () {
        callback(new Error('Wrong file type on avatar upload'));
      });
    }

    resize(fileInfo.path, {
      store: N.models.core.File,
      ext: ext,
      maxSize: typeConfig.max_size,
      resize: typeConfig.resize
    }, function (err, data) {

      fs.unlink(fileInfo.path, function () {
        if (err) {
          callback(err);
          return;
        }

        env.data.old_avatar = env.data.user.avatar_id;
        env.res.avatar_id = data.id;
        N.models.users.User.update({ _id: env.data.user._id }, { avatar_id: data.id }, callback);
      });
    });
  });


  // Remove old avatar
  //
  N.wire.after(apiPath, function save_media(env, callback) {
    if (!env.data.old_avatar) {
      callback();
      return;
    }

    N.models.core.File.remove(env.data.old_avatar, true, callback);
  });
};
