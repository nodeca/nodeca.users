// Shows album/all medias page


'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid: {
      type: 'integer',
      minimum: 1,
      required: true
    },
    album_id: {
      format: 'mongo'
    }
  });


  // Fetch owner
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env, callback) {
    N.wire.emit('internal:users.fetch_user_by_hid', env, callback);
  });


  // Fetch album info (by album_id)
  //
  N.wire.before(apiPath, function fetch_album(env, callback) {
    if (!env.params.album_id) {
      callback();
      return;
    }

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


  // Get medias list (subcall)
  //
  N.wire.on(apiPath, function get_user_albums(env, callback) {
    N.wire.emit('server:users.media.list', env, callback);
  });


  // Fill head meta
  //
  N.wire.after(apiPath, function fill_head(env) {
    var user = env.data.user;

    env.res.head = env.res.head || {};

    if (env.data.album) {
      env.res.head.title = env.t('title_album_with_user', { album: env.data.album.title, user: env.runtime.is_member ? user.name : user.nick });
      return;
    }

    env.res.head.title = env.t('title_with_user', { user: env.runtime.is_member ? user.name : user.nick });
  });


  // Fill breadcrumbs
  //
  N.wire.after(apiPath, function fill_breadcrumbs(env) {
    var user = env.data.user;

    var breadcrumbs = [];

    breadcrumbs.push({
      'text': env.runtime.is_member ? user.name : user.nick,
      'route': 'users.member',
      'params': { 'user_hid': user.hid }
    });

    breadcrumbs.push({
      'text': env.t('breadcrumbs_title'),
      'route': 'users.albums_root',
      'params': { 'user_hid': user.hid }
    });

    env.res.blocks.breadcrumbs = breadcrumbs;
  });
};
