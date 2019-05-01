// Get user activity counters across all modules
//
// Params:
//  - data.user_id (ObjectId)
//  - data.current_user_id (Object), same as env.user_info
//
// Returns:
//  - data.count (Number)
//
// Used in:
//  - member profile
//  - usercard
//

'use strict';


module.exports = function (N, apiPath) {

  N.wire.before(apiPath, { priority: -100 }, function activity_get_setup(data) {
    data.count = 0;
  });
};
