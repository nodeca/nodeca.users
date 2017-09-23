// Fill last user medias info
//
'use strict';


var _ = require('lodash');


module.exports = function (N) {

  var MEDIA_LIMIT = 7;


  // Fetch last user medias
  //
  N.wire.after('server:users.member', async function fetch_last_photos(env) {
    let mTypes = N.models.users.MediaInfo.types;

    let medias = await N.models.users.MediaInfo
                          .find({ user: env.data.user._id, type: { $in: mTypes.LIST_VISIBLE } })
                          .lean(true)
                          .sort('-media_id')
                          .limit(MEDIA_LIMIT);

    if (medias.length === 0) return;

    env.res.blocks = env.res.blocks || {};
    _.set(env.res, 'blocks.medias', { list: medias });
  });


  // Fetch user medias count
  //
  N.wire.after('server:users.member', async function fetch_photos_count(env) {
    let mTypes = N.models.users.MediaInfo.types;

    if (!_.get(env.res, 'blocks.medias')) return;

    let count = await N.models.users.MediaInfo
                          .find({ user: env.data.user._id, type: { $in: mTypes.LIST_VISIBLE } })
                          .count();

    env.res.blocks.medias.count = count;
  });
};
