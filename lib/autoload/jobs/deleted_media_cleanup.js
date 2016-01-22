// Remove marked as deleted mediainfo from database
//
'use strict';


const async = require('async');


module.exports = function (N) {

  N.wire.on('init:jobs', function register_deleted_media_cleanup() {
    const task_name = 'deleted_media_cleanup';

    if (!N.config.cron || !N.config.cron[task_name]) {
      return new Error(`No config defined for cron task "${task_name}"`);
    }

    N.queue.registerWorker({
      name: task_name,
      cron: N.config.cron[task_name],
      process: function (callback) {

        // Find all MediaInfo marked deleted
        N.models.users.MediaInfo.find({ type: { $in: N.models.users.MediaInfo.types.LIST_DELETED } })
            .exec(function (err, docs) {

          if (err) {
            callback(err);
            return;
          }

          // Remove one by one to use mongoose pre remove hooks
          async.each(docs, function (doc, next) {
            doc.remove(next);
          }, callback);
        });
      }
    });
  });
};
