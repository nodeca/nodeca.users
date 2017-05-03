// Upload media handler for uploading files via POST request
//
'use strict';


const _           = require('lodash');
const mime        = require('mime-types').lookup;
const path        = require('path');
const resizeParse = require('../../../_lib/resize_parse');


module.exports = function (N, apiPath) {

  const config = resizeParse(N.config.users.uploads);


  N.validate(apiPath, {
    album_id: { format: 'mongo', required: false },
    file:     { type: 'string',  required: true }
  });


  // Fetch album info (by album_id). Fetch default album if album_id not specified
  //
  N.wire.before(apiPath, function* fetch_album(env) {
    let queryParams = env.params.album_id ?
                      { _id: env.params.album_id, user: env.user_info.user_id } :
                      { user: env.user_info.user_id, 'default': true };

    let album = yield N.models.users.Album
                          .findOne(queryParams)
                          .lean(true);

    if (!album) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_album_not_found')
      };
    }

    env.data.album = album;
  });


  // Check permissions
  //
  N.wire.before(apiPath, function* check_permissions(env) {
    let users_can_upload_media = yield env.extras.settings.fetch('users_can_upload_media');

    if (!users_can_upload_media) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_permission')
      };
    }
  });


  // Check quota
  //
  N.wire.before(apiPath, function* check_quota(env) {
    let extra = yield N.models.users.UserExtra
                          .findOne({ user: env.user_info.user_id })
                          .select('media_size')
                          .lean(true);
    let users_media_total_quota_mb = yield env.extras.settings.fetch('users_media_total_quota_mb');

    if (users_media_total_quota_mb * 1024 * 1024 < extra.media_size) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_quota_exceeded', { quota_mb: users_media_total_quota_mb })
      };
    }
  });


  // Check file size and type
  //
  N.wire.before(apiPath, function* upload_media(env) {
    let fileInfo = env.req.files.file && env.req.files.file[0];

    if (!fileInfo) throw new Error('No file was uploaded');

    let users_media_single_quota_kb = yield env.extras.settings.fetch('users_media_single_quota_kb');

    if (fileInfo.size > users_media_single_quota_kb * 1024) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_file_size', { max_size_kb: users_media_single_quota_kb })
      };
    }

    // Usually file size and type are checked on client side,
    // but we must check it on server side for security reasons
    let allowedTypes = _.map(config.extensions, ext => mime(ext));

    if (allowedTypes.indexOf(fileInfo.headers['content-type']) === -1) {
      // Fallback attempt: FF can send strange mime,
      // `application/x-zip-compressed` instead of `application/zip`
      // Try to fix it.
      let mimeByExt = mime(path.extname(fileInfo.originalFilename || '').slice(1));

      if (allowedTypes.indexOf(mimeByExt) === -1) {
        throw {
          code: N.io.CLIENT_ERROR,
          message: env.t('err_invalid_ext', { file_name: fileInfo.originalFilename })
        };
      }

      fileInfo.headers['content-type'] = mimeByExt;
    }

    env.data.upload_file_info = fileInfo;
  });


  // Create image/binary (for images previews created automatically)
  //
  N.wire.on(apiPath, function* save_media(env) {
    let fileInfo = env.data.upload_file_info;

    let media = yield N.models.users.MediaInfo.createFile({
      album_id: env.data.album._id,
      user_id: env.user_info.user_id,
      path: fileInfo.path,
      name: fileInfo.originalFilename,
      // In case of blob fileInfo.name will be 'blob'.
      // Get extension from fileInfo.type.
      ext: (fileInfo.headers['content-type'] || '').split('/').pop()
    });

    env.res.media = media;
    env.data.media = media;
  });


  // Update album info
  //
  N.wire.after(apiPath, function* update_album_info(env) {
    yield N.models.users.Album.updateInfo(env.data.album._id);
  });


  // Update cover for default album
  //
  N.wire.after(apiPath, function* update_default(env) {
    if (!env.data.album.default) {
      return;
    }

    let mTypes = N.models.users.MediaInfo.types;
    let media = env.data.media;

    if (media.type !== mTypes.IMAGE) {
      return;
    }

    yield N.models.users.Album.update({ _id: env.data.album._id }, { cover_id: media.media_id });
  });


  // Mark user as active
  //
  N.wire.after(apiPath, function* set_active_flag(env) {
    yield N.wire.emit('internal:users.mark_user_active', env);
  });
};
