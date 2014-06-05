// Shows albums list for user by hid
'use strict';

module.exports = function (N, apiPath) {
  var User = N.models.users.User;

  N.validate(apiPath, {
    user_hid: {
      type: 'integer',
      minimum: 1,
      required: true
    },
    album_id: {
      type: 'string',
      default: '',
      required: false
    },
    all_photos: {
      type: 'string',
      default: '',
      required: false
    }
  });


  // Fetch album owner by 'hid'
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env, callback) {
    User
      .findOne({ 'hid': env.params.user_hid })
      .lean(true)
      .exec(function (err, user) {
        if (err) {
          callback(err);
          return;
        }

        // TODO: add permissions to view deleted users
        if (!user || !user.exists) {
          callback(N.io.NOT_FOUND);
          return;
        }

        env.res.user_hid = user.hid;
        env.data.user = user;
        callback();
      });
  });


  N.wire.on(apiPath, function get_user_albums(env, callback) {
    if (env.params.all_photos === 'all') {
      // TODO: show all photos for this user
      env.res.showAsAlbums = env.data.showAsAlbums = false;
      return callback();
    }

    if (env.params.album_id !== '') {
      // TODO: show all photos for this album
      env.res.showAsAlbums = env.data.showAsAlbums = false;
      return callback();
    }

    // Show albums list
    env.res.showAsAlbums = env.data.showAsAlbums = true;
    N.wire.emit('server:users.member.albums.albums_list', env, callback);
  });


  // Fill head meta
  //
  N.wire.after(apiPath, function fill_head(env) {
    var user = env.data.user;

    env.res.head = env.res.head || {};

    if (env.data.showAsAlbums) {
      env.res.head.title = env.t('title_with_user', { user: env.runtime.is_member ? user.name : user.nick });
      return;
    }

    // TODO: title for photos page
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
      'route': 'users.member.albums',
      'params': { 'user_hid': user.hid }
    });

    env.res.blocks.breadcrumbs = breadcrumbs;
  });
};
