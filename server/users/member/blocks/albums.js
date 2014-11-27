// Fill last user albums info
//
'use strict';


module.exports = function (N) {

  var ALBUMS_LIMIT = 7;


  // Fetch last user photos
  //
  N.wire.after('server:users.member', function fetch_last_photos(env, callback) {

    N.models.users.Album
      .find({ user_id: env.data.user._id })
      .lean(true)
      .sort('-last_ts')
      .limit(ALBUMS_LIMIT + 1) // Remove default album later to optimize query
      .exec(function (err, albums) {
        if (err) {
          callback(err);
          return;
        }

        // Try to remove default album
        albums = albums.filter(function (album) { return album.default !== true; });

        if (albums.length === 0) {
          callback();
          return;
        }

        // No default album in list, remove last
        if (albums.length > ALBUMS_LIMIT) {
          albums.pop();
        }

        env.res.blocks = env.res.blocks || {};
        env.res.blocks.albums = {
          list: albums
        };

        callback();
      });
  });


  // Fetch user albums count
  //
  N.wire.after('server:users.member', function fetch_photos_count(env, callback) {

    if (!env.res.blocks.albums) {
      callback();
      return;
    }

    N.models.users.Album.find({ user_id: env.data.user._id }).count(function (err, count) {
      if (err) {
        callback(err);
        return;
      }

      env.res.blocks.albums.count = count - 1; // Don't count default album
      callback();
    });
  });
};
