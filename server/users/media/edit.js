// Show media edit page


'use strict';


module.exports = function (N, apiPath) {


  N.validate(apiPath, {
    media_id: { format: 'mongo', required: true }
  });


  // Fetch media
  //
  N.wire.on(apiPath, function* fetch_media(env) {
    let mTypes = N.models.users.MediaInfo.types;

    let media = yield N.models.users.MediaInfo
                          .findOne({ media_id: env.params.media_id, type: { $in: mTypes.LIST_VISIBLE } })
                          .lean(true);

    if (!media) throw N.io.NOT_FOUND;

    // Check media owner
    if (env.user_info.user_id !== String(media.user_id)) throw N.io.FORBIDDEN;

    env.res.media = env.data.media = media;
  });


  // Fetch albums list (_id and title) for album change dropdown
  //
  N.wire.after(apiPath, function* fetch_albums(env) {
    var media = env.data.media;

    env.res.albums = yield N.models.users.Album
                              .find({ user_id: media.user_id })
                              .sort('-default -last_ts')
                              .select('_id title')
                              .lean(true);
  });
};
