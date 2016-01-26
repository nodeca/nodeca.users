// Cleanup old markers
//
'use strict';


module.exports = function (N) {
  N.wire.on('init:jobs', function register_markers_cleanup() {
    const task_name = 'markers_cleanup';

    if (!N.config.cron || !N.config.cron[task_name]) {
      return new Error(`No config defined for cron task "${task_name}"`);
    }

    N.queue.registerWorker({
      name: task_name,
      cron: N.config.cron[task_name],
      process(callback) {
        N.models.users.Marker.cleanup()
          .catch(err => {
            // don't return an error in the callback because we don't need automatic reloading
            N.logger.error(`"${task_name}" job error: ${err.message || err}`);
          })
          .then(callback);
      }
    });
  });
};
