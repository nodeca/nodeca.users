// Fetch media list


'use strict';

module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    album_id: { format: 'mongo', required: true }
  });


  // Find and processes user media
  //
  N.wire.on(apiPath, function* get_user_medias(env) {
    let mTypes = N.models.users.MediaInfo.types;

    env.res.medias = yield N.models.users.MediaInfo
                              .find({ type: mTypes.IMAGE, album_id: env.params.album_id })
                              .lean(true)
                              .sort('-media_id');
  });
};
