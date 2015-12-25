// Fill last user medias info
//
'use strict';


var _ = require('lodash');


module.exports = function (N) {

  var MEDIA_LIMIT = 7;


  // Fetch last user medias
  //
  N.wire.after('server:users.member', function fetch_last_photos(env, callback) {
    var mTypes = N.models.users.MediaInfo.types;

    N.models.users.MediaInfo
      .find({ user_id: env.data.user._id, type: { $in: mTypes.LIST_VISIBLE } })
      .lean(true)
      .sort('-media_id')
      .limit(MEDIA_LIMIT)
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
        _.set(env.res, 'blocks.medias', { list: medias });

        callback();
      });
  });


  // Fetch user medias count
  //
  N.wire.after('server:users.member', function fetch_photos_count(env, callback) {
    var mTypes = N.models.users.MediaInfo.types;

    if (!_.get(env.res, 'blocks.medias')) {
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
