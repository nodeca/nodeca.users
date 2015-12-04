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
    // Cancel previous task if exists (reset delay for send)
    N.queue.cancel(N.queue.__prefix__ + 'notify:' + params.type + '_' + params.src, function (err) {
      if (err) {
        callback(err);
        return;
      }

      var to = Array.isArray(params.to) ? params.to : [ params.to ];

      // Add new task with delay
      N.queue.postpone('notify', _.assign({}, params, { to: to }), callback);
    });
  });
};
