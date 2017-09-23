// Create album


'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    title: {
      type: 'string',
      minLength: 1,
      required: true
    }
  });


  // Check auth
  // TODO: Add permissions check
  //
  N.wire.before(apiPath, function check_user_auth(env) {
    if (!env.user_info.is_member) throw N.io.FORBIDDEN;
  });


  N.wire.on(apiPath, async function create_user_album(env) {
    var album = new N.models.users.Album();
    album.user = env.user_info.user_id;
    album.title = env.params.title;
    album.last_ts = new Date();

    await album.save();

    env.res.album = album;
  });


  // Mark user as active
  //
  N.wire.after(apiPath, async function set_active_flag(env) {
    await N.wire.emit('internal:users.mark_user_active', env);
  });
};
