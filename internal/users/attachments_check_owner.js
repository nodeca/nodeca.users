// Check that all attachments are owned by current user (or return error)
//
// Expects:
// - env.params.attach (Array)
// - env.user_info.user_id
//
'use strict';

var _ = require('lodash');

module.exports = function (N, apiPath) {

  N.wire.on(apiPath, function attachments_check_owner(env, callback) {

    var mediaIds = _.uniq(_.pluck(env.params.attach, 'media_id'));

    // Find media info by `media_id` (from params) and `user_id`
    N.models.users.MediaInfo
        .where('media_id').in(mediaIds)
        .where('user_id').equals(env.user_info.user_id)
        .select('media_id')
        .lean(true)
        .exec(function (err, result) {

      if (err) {
        callback(err);
        return;
      }

      // If any media ID not found in database
      if (result.length !== mediaIds.length) {
        callback('Invalid attachments passed');
        return;
      }

      callback();
    });
  });
};
