// Fill last user albums info
//
'use strict';


const _ = require('lodash');


module.exports = function (N) {

  const ALBUMS_LIMIT = 7;


  // Fetch last user photos
  //
  N.wire.after('server:users.member', async function fetch_last_photos(env) {
    let query = N.models.users.Album.find()
                    .where('user').equals(env.data.user._id)
                    .lean(true)
                    .sort('-last_ts')
                    .limit(ALBUMS_LIMIT + 1); // Remove default album later to optimize query

    if (env.user_info.user_hid !== env.data.user.hid) {
      // Hide empty albums for non-owner
      query.where('count').gt(0);
    }

    let albums = await query;

    // Try to remove default album, but still show default album for the
    // owner if it's the only album (so user can navigate to his albums page)
    if (env.user_info.user_hid !== env.data.user.hid || albums.length > 1) {
      albums = albums.filter(album => album.default !== true);
    }

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
  N.wire.after('server:users.member', async function fetch_photos_count(env) {

    if (!_.get(env.res, 'blocks.albums')) return;

    let query = N.models.users.Album.find()
                    .where('user').equals(env.data.user._id)
                    .where('default').equals(false) // don't count default album
                    .countDocuments();

    if (env.user_info.user_hid !== env.data.user.hid) {
      // Hide empty albums for non-owner
      query.where('count').gt(0);
    }

    env.res.blocks.albums.count = await query;
  });
};
