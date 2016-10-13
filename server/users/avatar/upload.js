// Upload avatar handler for uploading avatars via POST request
//
'use strict';


const formidable  = require('formidable');
const tmpDir      = require('os').tmpdir();
const _           = require('lodash');
const resizeParse = require('nodeca.users/server/_lib/resize_parse');
const resize      = require('nodeca.users/models/users/_lib/resize');
const unlink      = require('mz/fs').unlink;


module.exports = function (N, apiPath) {

  const config = resizeParse(N.config.users.avatars);

  // CSRF comes in post data and checked separately
  N.validate(apiPath, {});


  // Check permissions
  //
  N.wire.before(apiPath, function check_permissions(env) {
    if (env.session.is_guest) return N.io.FORBIDDEN;
  });


  // Fetch user
  //
  N.wire.before(apiPath, function* fetch_user(env) {
    env.data.user = yield N.models.users.User
                              .findOne({ _id: env.user_info.user_id })
                              .lean(true);

    if (!env.data.user) throw N.io.NOT_FOUND;
  });


  // Check file size early by header and terminate immediately for big uploads
  //
  N.wire.before(apiPath, function check_file_size(env) {
    // `Content-Length` = (files + wrappers) + (params + wrappers)
    //
    // When single big file sent, `Content-Length` ~ FileSize.
    // Difference is < 200 bytes.
    let size = env.origin.req.headers['content-length'];

    if (!size) throw N.io.LENGTH_REQUIRED;

    // Don't allow > 1 MB. That should never happen,
    // because avatar already resized on client side
    if (size > 1 * 1024 * 1024) throw N.io.FORBIDDEN;
  });


  // Fetch post body with files via formidable
  //
  N.wire.before(apiPath, function upload_media(env, callback) {
    let form = new formidable.IncomingForm();

    form.uploadDir = tmpDir;

    form.on('progress', (bytesReceived, contentLength) => {

      // Terminate connection if `Content-Length` header is fake
      if (bytesReceived > contentLength) {
        form._error(new Error('Data size too big (should be equal to Content-Length)'));
      }
    });

    form.parse(env.origin.req, (err, fields, files) => {
      files = _.toArray(files);

      function fail(err) {
        // Don't care unlink result, forward previous error
        files.forEach(f => unlink(f.path).catch(() => {}));
        callback(err);
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
  N.wire.on(apiPath, function* save_media(env) {
    let fileInfo = env.data.upload_file_info;
    let ext = fileInfo.type.split('/').pop();
    let typeConfig = config.types[ext];

    try {
      if (!typeConfig) throw new Error('Wrong file type on avatar upload');

      let data = yield resize(fileInfo.path, {
        store: N.models.core.File,
        ext,
        maxSize: typeConfig.max_size,
        resize: typeConfig.resize
      });

      env.data.old_avatar = env.data.user.avatar_id;
      env.res.avatar_id = data.id;

      yield N.models.users.User.update(
        { _id: env.data.user._id },
        { $set: { avatar_id: data.id } }
      );
    } catch (err) {
      yield unlink(fileInfo.path);
      throw err;
    }

    yield unlink(fileInfo.path);
  });


  // Remove old avatar
  //
  N.wire.after(apiPath, function* save_media(env) {
    if (!env.data.old_avatar) return;

    yield N.models.core.File.remove(env.data.old_avatar, true);
  });


  // Mark user as active
  //
  N.wire.after(apiPath, function* set_active_flag(env) {
    yield N.wire.emit('internal:users.mark_user_active', env);
  });
};
