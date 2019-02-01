// Check that all attachments are owned by current user (or return error)
//
// Expects:
// - locals.attachments (Array)
// - locals.user_id
//
'use strict';

const _ = require('lodash');

module.exports = function (N, apiPath) {

  N.wire.on(apiPath, async function attachments_check_owner(locals) {

    let mediaIds = _.uniq(locals.attachments);

    // Find media info by `media_id` (from params) and `user_id`
    let result = await N.models.users.MediaInfo
                          .where('media_id').in(mediaIds)
                          .where('user').equals(locals.user_id)
                          .select('media_id')
                          .lean(true);

    // If any media ID not found in database
    if (result.length !== mediaIds.length) throw 'Invalid attachments passed';
  });
};
