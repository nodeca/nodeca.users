// Check that all attachments are owned by current user (or return error)
//
// Expects:
// - env.params.attach (Array)
// - env.user_info.user_id
//
'use strict';

const _ = require('lodash');

module.exports = function (N, apiPath) {

  N.wire.on(apiPath, function* attachments_check_owner(env) {

    let mediaIds = _.uniq(env.params.attach);

    // Find media info by `media_id` (from params) and `user_id`
    let result = yield N.models.users.MediaInfo
                          .where('media_id').in(mediaIds)
                          .where('user_id').equals(env.user_info.user_id)
                          .select('media_id')
                          .lean(true);

    // If any media ID not found in database
    if (result.length !== mediaIds.length) throw 'Invalid attachments passed';
  });
};
