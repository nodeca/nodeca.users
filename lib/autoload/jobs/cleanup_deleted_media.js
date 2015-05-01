// Remove marked as deleted mediainfo from database
//
'use strict';


var async = require('async');


module.exports = function (N) {

  N.wire.on('init:jobs', function register_cleanup_deleted_media() {
    N.queue.registerWorker({
      name: 'cleanup_deleted_media',
      cron: N.config.cron ? N.config.cron.cleanup_deleted_media : null,
      process: function (__, callback) {

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
