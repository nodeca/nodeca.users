// Shows albums list for user by hid
'use strict';

module.exports = function (N, apiPath) {
  var User = N.models.users.User;

  N.validate(apiPath, {
    member_hid: {
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
      .findOne({ 'hid': env.params.member_hid })
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

        env.res.user_name = user.name;
        env.data.user = user;
        callback();
      });
  });


  N.wire.on(apiPath, function get_user_albums(env, callback) {
    if (env.params.all_photos === 'all') {
      // TODO: show all photos for this user
      env.res.showAsAlbums = false;
      return callback();
    }

    if (env.params.album_id !== '') {
      // TODO: show all photos for this album
      env.res.showAsAlbums = false;
      return callback();
    }

    // Show albums list
    env.res.showAsAlbums = true;
    N.wire.emit('server:users.member.albums.albums_list', env, callback);
  });
};
