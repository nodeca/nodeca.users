// Fetch media list


'use strict';

var PHOTOS_PER_PAGE = 16;


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid: { type: 'integer', minimum: 1, required: true },
    album_id: { format: 'mongo' },
    page: { type: 'integer' }
  });


  // Fetch owner
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env, callback) {
    N.wire.emit('internal:users.fetch_user_by_hid', env, callback);
  });


  // Find and processes user media
  //
  N.wire.on(apiPath, function get_user_medias(env, callback) {
    var mTypes = N.models.users.MediaInfo.types;

    var query = N.models.users.MediaInfo
                  .find({ user_id: env.data.user._id, type: { $in: mTypes.LIST_VISIBLE } })
                  .lean(true)
                  .sort('-ts');

    // If album_id not set, will fetch all user medias
    if (env.params.album_id) {
      query.where({ 'album_id': env.params.album_id });
    }

    var page = env.params.page || env.data.media_page;
    if (page) {
      query.skip((page - 1) * PHOTOS_PER_PAGE).limit(PHOTOS_PER_PAGE);
      env.res.photos_per_page = PHOTOS_PER_PAGE;
    }

    query.exec(function (err, result) {
      if (err) {
        callback(err);
        return;
      }

      // For check is user owner
      env.res.user_hid = env.data.user.hid;

      env.res.medias = result;

      callback();
    });
  });
};
