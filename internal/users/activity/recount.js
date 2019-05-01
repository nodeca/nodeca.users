// Schedule recount for user activity counters
//
// Params:
//  - array of
//     - { type: String, params: Object }
//
// Schedules task that calls for each input method
// N.wire.emit('internal:users.activity.update_job.' + type, params)
//

'use strict';


module.exports = function (N, apiPath) {

  N.wire.on(apiPath, async function activity_schedule_recount(bulk_data) {
    await N.redis.saddAsync('activity_update',
      bulk_data.map(([ type, params ]) => JSON.stringify([ type, params ]))
    );
    N.queue.activity_update().run();
  });
};
