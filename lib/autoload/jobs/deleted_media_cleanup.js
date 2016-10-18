// Remove marked as deleted mediainfo from database
//
'use strict';


const Promise = require('bluebird');


module.exports = function (N) {

  N.wire.on('init:jobs', function register_deleted_media_cleanup() {
    const task_name = 'deleted_media_cleanup';

    if (!N.config.cron || !N.config.cron[task_name]) {
      return new Error(`No config defined for cron task "${task_name}"`);
    }

    N.queue.registerTask({
      name: task_name,
      cron: N.config.cron[task_name],
      process: Promise.coroutine(function* () {

        // Find all MediaInfo marked deleted
        let docs = yield N.models.users.MediaInfo.find({ type: { $in: N.models.users.MediaInfo.types.LIST_DELETED } });

        // Remove one by one to use mongoose pre remove hooks
        yield Promise.all(docs.map(doc => doc.remove()));
      })
    });
  });
};
