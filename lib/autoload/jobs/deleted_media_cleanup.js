// Remove marked as deleted mediainfo from database
//
'use strict';


module.exports = function (N) {

  N.wire.on('init:jobs', function register_deleted_media_cleanup() {
    const task_name = 'deleted_media_cleanup';

    if (!N.config.cron || !N.config.cron[task_name]) {
      return new Error(`No config defined for cron task "${task_name}"`);
    }

    N.queue.registerTask({
      name: task_name,
      pool: 'hard',
      cron: N.config.cron[task_name],
      async process() {

        // Find all MediaInfo marked deleted
        let docs = await N.models.users.MediaInfo.find({ type: { $in: N.models.users.MediaInfo.types.LIST_DELETED } });

        // Remove one by one to use mongoose pre remove hooks
        await Promise.all(docs.map(doc => doc.remove()));
      }
    });
  });
};
