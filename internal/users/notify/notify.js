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


var _ = require('lodash');


module.exports = function (N, apiPath) {
  N.wire.on(apiPath, function notification_add(params, callback) {
    var taskData = _.assign({}, params, { to: Array.isArray(params.to) ? params.to : [ params.to ] });

    // Cancel previous task if exists (reset delay for send)
    N.queue.cancel('notify', N.queue.worker('notify').taskID(taskData), function (err) {
      if (err) {
        callback(err);
        return;
      }

      // Add new task with delay
      N.queue.postpone('notify', taskData, callback);
    });
  });
};
