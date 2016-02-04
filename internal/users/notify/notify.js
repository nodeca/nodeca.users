// Add notification to queue (with delay). If the same notification already
// exists - reset delay counter.
//
// params:
//
// - src (ObjectId) - content _id
// - to (ObjectId|[ObjectId]) - recipient id, could be array
// - type (String) - notification type
//
'use strict';


const _ = require('lodash');


module.exports = function (N, apiPath) {
  N.wire.on(apiPath, function* notification_add(params) {
    let taskData = _.assign({}, params, { to: Array.isArray(params.to) ? params.to : [ params.to ] });
    let worker = N.queue.worker('notify');

    // Cancel previous task if exists (reset delay for send)
    yield worker.cancel(worker.taskID(taskData));
    // Add new task with delay
    yield worker.postpone(taskData);
  });
};
