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
    var task_name = 'notify';

    N.queue.registerWorker({
      name: task_name,

      // 5 minute delay by default
      postponeDelay: 5 * 60 * 1000,

      taskID: taskData => taskData.type + '_' + taskData.src,

      process(callback) {
        var local_env = _.assign({ messages: {} }, this.data);

        N.wire.emit('internal:users.notify.deliver', local_env, callback);
      }
    });
  });
};
