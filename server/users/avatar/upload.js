// Upload avatar handler for uploading avatars via POST request
//
'use strict';


const resizeParse = require('nodeca.users/server/_lib/resize_parse');
const resize      = require('nodeca.users/models/users/_lib/resize');


module.exports = function (N, apiPath) {

  const config = resizeParse(N.config.users.avatars);


  N.validate(apiPath, {
    avatar: { type: 'string', required: true }
  });


  // Check permissions
  //
  N.wire.before(apiPath, function check_permissions(env) {
    if (!env.user_info.is_member) throw N.io.FORBIDDEN;
  });


  // Fetch user
  //
  N.wire.before(apiPath, async function fetch_user(env) {
    env.data.user = await N.models.users.User
                              .findOne({ _id: env.user_info.user_id })
                              .lean(true);

    if (!env.data.user) throw N.io.NOT_FOUND;
  });


  // Create image/binary (for images previews created automatically)
  //
  N.wire.on(apiPath, async function save_media(env) {
    let fileInfo = env.req.files.avatar && env.req.files.avatar[0];

    if (!fileInfo) throw new Error('No file was uploaded');

    let ext = (fileInfo.headers['content-type'] || '').split('/').pop();
    let typeConfig = config.types[ext];

    if (!typeConfig) throw new Error('Wrong file type on avatar upload');

    let data = await resize(fileInfo.path, {
      store: N.models.core.File,
      ext,
      maxSize: typeConfig.max_size,
      resize: typeConfig.resize
    });

    env.data.old_avatar = env.data.user.avatar_id;
    env.res.avatar_id = data.id;

    await N.models.users.User.update(
      { _id: env.data.user._id },
      { $set: { avatar_id: data.id } }
    );
  });


  // Remove old avatar
  //
  N.wire.after(apiPath, async function save_media(env) {
    if (!env.data.old_avatar) return;

    await N.models.core.File.remove(env.data.old_avatar, true);
  });


  // Mark user as active
  //
  N.wire.after(apiPath, async function set_active_flag(env) {
    await N.wire.emit('internal:users.mark_user_active', env);
  });
};
