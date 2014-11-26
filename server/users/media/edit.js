// Show media edit page


'use strict';


module.exports = function (N, apiPath) {


  N.validate(apiPath, {
    media_id: { format: 'mongo', required: true }
  });


  // Fetch media
  //
  N.wire.on(apiPath, function fetch_media (env, callback) {
    var mTypes = N.models.users.MediaInfo.types;

    N.models.users.MediaInfo
      .findOne({ media_id: env.params.media_id, type: { $in: mTypes.LIST_VISIBLE } })
      .lean(true)
      .exec(function (err, media) {
        if (err) {
          callback(err);
          return;
        }

        if (!media) {
          callback(N.io.NOT_FOUND);
          return;
        }

        // Check media owner
        if (env.session.user_id !== String(media.user_id)) {
          callback(N.io.FORBIDDEN);
          return;
        }

        env.res.media = env.data.media = media;
        callback();
      });
  });


  // Fetch albums list (_id and title) for album change dropdown
  //
  N.wire.after(apiPath, function fetch_albums(env, callback) {
    var media = env.data.media;

    N.models.users.Album
      .find({ user_id: media.user_id })
      .sort('-default -last_ts')
      .select('_id title')
      .lean(true)
      .exec(function (err, result) {
        if (err) {
          callback(err);
          return;
        }

        env.res.albums = result;
        callback();
      });
  });
};
