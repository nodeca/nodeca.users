'use strict';


module.exports = function (N) {

  var PHOTO_COUNT = 7;


  // Fetch last user photos
  //
  N.wire.after('server:users.member', function fetch_last_photos(env, callback) {

    N.models.users.Media
      .find({ 'user_id': env.data.user._id, exists: true })
      .lean(true)
      .sort('-ts')
      .limit(PHOTO_COUNT)
      .exec(function (err, photos) {
        if (err) {
          callback(err);
          return;
        }

        if (photos.length === 0) {
          callback();
          return;
        }

        env.res.blocks = env.res.blocks || {};
        env.res.blocks.photos = {
          photos: photos,
          user_hid: env.data.user.hid
        };

        callback();
      });
  });


  // Fetch user photos count
  //
  N.wire.after('server:users.member', function fetch_photos_count(env, callback) {

    if (!env.res.blocks.photos) {
      callback();
      return;
    }

    N.models.users.Media.find({ 'user_id': env.data.user._id, exists: true }).count(function (err, count) {
      if (err) {
        callback(err);
        return;
      }

      env.res.blocks.photos.count = count;
      callback();
    });
  });
};
