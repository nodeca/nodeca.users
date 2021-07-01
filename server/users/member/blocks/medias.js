// Fill last user medias info
//
'use strict';


module.exports = function (N) {

  const MEDIA_LIMIT = 7;


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
    env.res.blocks.medias = { list: medias };
  });


  // Fetch user medias count
  //
  N.wire.after('server:users.member', async function fetch_photos_count(env) {
    let mTypes = N.models.users.MediaInfo.types;

    if (!env.res.blocks?.medias) return;

    let count = await N.models.users.MediaInfo
                          .find({ user: env.data.user._id, type: { $in: mTypes.LIST_VISIBLE } })
                          .countDocuments();

    env.res.blocks.medias.count = count;
  });
};
