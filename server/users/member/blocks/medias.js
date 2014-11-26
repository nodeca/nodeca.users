'use strict';


module.exports = function (N) {

  var PHOTO_COUNT = 7;


  // Fetch last user medias
  //
  N.wire.after('server:users.member', function fetch_last_photos(env, callback) {
    var mTypes = N.models.users.MediaInfo.types;

    N.models.users.MediaInfo
      .find({ user_id: env.data.user._id, type: { $in: mTypes.LIST_VISIBLE } })
      .lean(true)
      .sort('-ts')
      .limit(PHOTO_COUNT)
      .exec(function (err, medias) {
        if (err) {
          callback(err);
          return;
        }

        if (medias.length === 0) {
          callback();
          return;
        }

        env.res.blocks = env.res.blocks || {};
        env.res.blocks.medias = {
          medias: medias,
          user_hid: env.data.user.hid
        };

        callback();
      });
  });


  // Fetch user photos count
  //
  N.wire.after('server:users.member', function fetch_photos_count(env, callback) {
    var mTypes = N.models.users.MediaInfo.types;

    if (!env.res.blocks.medias) {
      callback();
      return;
    }

    N.models.users.MediaInfo
      .find({ user_id: env.data.user._id, type: { $in: mTypes.LIST_VISIBLE } })
      .count(function (err, count) {
        if (err) {
          callback(err);
          return;
        }

        env.res.blocks.medias.count = count;
        callback();
      });
  });
};
