// Fill last user albums info
//
'use strict';


var _ = require('lodash');


module.exports = function (N) {

  var ALBUMS_LIMIT = 7;


  // Fetch last user photos
  //
  N.wire.after('server:users.member', function* fetch_last_photos(env) {

    let albums = yield N.models.users.Album
                          .find({ user: env.data.user._id })
                          .lean(true)
                          .sort('-last_ts')
                          .limit(ALBUMS_LIMIT + 1); // Remove default album later to optimize query

    // Try to remove default album
    albums = albums.filter(album => album.default !== true);

    if (albums.length === 0) return;

    // No default album in list, remove last
    if (albums.length > ALBUMS_LIMIT) {
      albums.pop();
    }

    env.res.blocks = env.res.blocks || {};
    _.set(env.res, 'blocks.albums', { list: albums });
  });


  // Fetch user albums count
  //
  N.wire.after('server:users.member', function* fetch_photos_count(env) {

    if (!_.get(env.res, 'blocks.albums')) return;

    let count = yield N.models.users.Album
                          .find({ user: env.data.user._id })
                          .count();

    env.res.blocks.albums.count = count - 1; // Don't count default album
  });
};
