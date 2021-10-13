// Add notification to queue (with delay). If the same notification already
// exists - reset delay counter.
//
// params:
//
// - src (ObjectId) - content _id
// - ignore ([ObjectId]) - list of recipient ids we shouldn't send this to
// - type (String) - notification type
//
'use strict';


module.exports = function (N, apiPath) {
  N.wire.on(apiPath, async function notification_add(taskData) {
    // Cancel previous task if exists (reset delay for send)
    await N.queue.cancel(`notify_${taskData.type}_${taskData.src}`);
    // Add new task with delay
    await N.queue.notify(taskData).postpone();
  });
};
