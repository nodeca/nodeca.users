// Show album edit form


'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid: { type: 'integer', minimum: 1, required: true },
    album_id: { format: 'mongo', required: true }
  });


  // Fetch owner by hid
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env) {
    return N.wire.emit('internal:users.fetch_user_by_hid', env);
  });


  // Fetch album info
  //
  N.wire.before(apiPath, function* fetch_album(env) {
    let album = yield N.models.users.Album.findOne({ _id: env.params.album_id }).lean(true);

    if (!album) {
      throw N.io.NOT_FOUND;
    }

    env.data.album = album;
  });


  // Check permissions
  //
  N.wire.before(apiPath, function check_permissions(env) {
    let album = env.data.album;

    // Wrong member_hid parameter
    if (env.data.user._id.toString() !== album.user.toString()) {
      return N.io.NOT_FOUND;
    }

    // No one can edit default album
    if (album.default) {
      return N.io.NOT_FOUND;
    }

    if (env.user_info.user_id !== String(album.user)) {
      return N.io.FORBIDDEN;
    }
  });


  // Fill response
  //
  N.wire.on(apiPath, function fill_response(env) {
    env.res.album = env.data.album;
    env.res.head = env.res.head || {};
    env.res.head.title = env.t('title');
    env.res.user_hid = env.data.user.hid;
  });

  // Fill breadcrumbs
  //
  N.wire.after(apiPath, function* fill_breadcrumbs(env) {
    let user = env.data.user;
    let album = env.data.album;

    yield N.wire.emit('internal:users.breadcrumbs.fill_albums', env);

    env.data.breadcrumbs.push({
      text:   album.title,
      route:  'users.album',
      params: { user_hid: user.hid, album_id: album._id }
    });

    env.res.breadcrumbs = env.data.breadcrumbs;
  });
};
