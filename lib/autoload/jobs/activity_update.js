// Recalculate user activity counters
//
// In:
//  - redis set `activity_update`, data is: JSON.stringify([ type, params ])
//
// Calls N.wire.emit('internal:users.activity.update_job.' + type, params)
//

'use strict';


module.exports = function (N) {

  N.wire.on('init:jobs', function register_activity_update() {
    N.queue.registerTask({
      name: 'activity_update',

      // static id to ensure that it's singleton
      taskID: () => 'activity_update',

      async process() {
        for (;;) {
          let command = await N.redis.spopAsync('activity_update');
          if (!command) break;

          let [ type, params ] = JSON.parse(command);

          await N.wire.emit('internal:users.activity.update_job.' + type, params);
        }
      }
    });
  });
};
