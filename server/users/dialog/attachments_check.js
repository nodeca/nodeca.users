// Check if draft attachments exist
//
// params:
//
// - media_ids - array of media_id to check
//
// result - array of existing media_id
//
'use strict';


const _ = require('lodash');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    media_ids: { type: 'array', required: true, uniqueItems: true, items: { format: 'mongo' } }
  });


  N.wire.on(apiPath, function* attachments_check(env) {
    let res = yield N.models.users.MediaInfo.find()
                        .where('media_id').in(env.params.media_ids)
                        .where('user_id').equals(env.user_info.user_id)
                        .where('type').in(N.models.users.MediaInfo.types.LIST_VISIBLE)
                        .select('media_id')
                        .lean(true);

    env.res.media_ids = _.map(res, 'media_id');
  });
};
