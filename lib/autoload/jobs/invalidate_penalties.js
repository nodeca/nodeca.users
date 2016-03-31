// Invalidate penalties
//
'use strict';


module.exports = function (N) {
  N.wire.on('init:jobs', function register_invalidate_penalties() {
    const task_name = 'invalidate_penalties';

    if (!N.config.cron || !N.config.cron[task_name]) {
      return new Error(`No config defined for cron task "${task_name}"`);
    }

    N.queue.registerWorker({
      name: task_name,
      cron: N.config.cron[task_name],
      * process() {
        try {
          // Subcall
          yield N.wire.emit('internal:users.infraction.invalidate_penalties');
        } catch (err) {
          // don't propagate errors because we don't need automatic reloading
          N.logger.error('"%s" job error: %s', task_name, err.message || err);
        }
      }
    });
  });
};
