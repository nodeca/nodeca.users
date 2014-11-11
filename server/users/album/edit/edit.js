// Show album edit form


'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid: { type: 'integer', minimum: 1, required: true },
    album_id: { format: 'mongo', required: true }
  });


  // Fetch owner by hid
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env, callback) {
    N.wire.emit('internal:users.fetch_user_by_hid', env, callback);
  });


  // Fetch album info
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
  N.wire.before(apiPath, function check_permissions(env) {
    var album = env.data.album;

    // Wrong member_hid parameter
    if (env.data.user._id.toString() !== album.user_id.toString()) {
      return N.io.NOT_FOUND;
    }

    // No one can edit default album
    if (album.default) {
      return N.io.NOT_FOUND;
    }

    if (env.session.user_id !== String(album.user_id)) {
      return N.io.FORBIDDEN;
    }
  });


  // Fill response
  //
  N.wire.on(apiPath, function fill_response(env) {
    env.res.album = env.data.album;
    env.res.head = env.res.head || {};
    env.res.head.title = env.t('title');
  });

  // Fill breadcrumbs
  //
  N.wire.after(apiPath, function fill_breadcrumbs(env) {
    var user = env.data.user;
    var album = env.data.album;

    N.wire.emit('internal:users.breadcrumbs.fill_albums', env);

    env.data.breadcrumbs.push({
      'text': album.title,
      'route': 'users.album',
      'params': { 'user_hid': user.hid, 'album_id': album._id }
    });

    env.res.breadcrumbs = env.data.breadcrumbs;
  });
};
