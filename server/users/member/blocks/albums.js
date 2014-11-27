'use strict';

var _ = require('lodash');

module.exports = function (N) {

  var ALBUMS_COUNT = 7;


  // Fetch last user photos
  //
  N.wire.after('server:users.member', function fetch_last_photos(env, callback) {

    N.models.users.Album
      .find({ user_id: env.data.user._id })
      .lean(true)
      .sort('-last_ts')
      .limit(ALBUMS_COUNT + 1)
      .exec(function (err, albums) {
        if (err) {
          callback(err);
          return;
        }

        if (albums.length === 0) {
          callback();
          return;
        }

        // Try to remove default album
        _.remove(albums, function (album) { return album.default; });

        // No default album in array, remove last
        if (albums.length > ALBUMS_COUNT) {
          albums.pop();
        }

        env.res.blocks = env.res.blocks || {};
        env.res.blocks.albums = {
          list: albums
        };

        callback();
      });
  });


  // Fetch user photos count
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

      env.res.blocks.albums.count = count;
      callback();
    });
  });
};
