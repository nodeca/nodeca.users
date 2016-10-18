// Prepare and send notifications
//
// internal:users.notify.deliver
//
// - src (ObjectId) - content _id
// - to ([ObjectId]) - users _id array
// - type (String) - notification type
// - data (Object)
//   - topic (N.models.forum.Topic)
//   - section (N.models.forum.Section)
//   - etc.
//
'use strict';


var _ = require('lodash');


module.exports = function (N) {
  N.wire.on('init:jobs', function register_notifications_send() {
    const task_name = 'notify';

    N.queue.registerTask({
      name: task_name,

      // 5 minute delay by default
      postponeDelay: 5 * 60 * 1000,

      taskID: data => `${task_name}_${data.type}_${data.src}`,

      process(data) {
        let local_env = _.assign({ messages: {} }, data);

        return N.wire.emit('internal:users.notify.deliver', local_env);
      }
    });
  });
};
