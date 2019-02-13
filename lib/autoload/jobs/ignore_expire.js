// Remove expired ignore entries
//
'use strict';


module.exports = function (N) {
  N.wire.on('init:jobs', function register_ignore_expire() {
    const task_name = 'ignore_expire';

    if (!N.config.cron || !N.config.cron[task_name]) {
      return new Error(`No config defined for cron task "${task_name}"`);
    }

    N.queue.registerTask({
      name: task_name,
      pool: 'hard',
      cron: N.config.cron[task_name],
      async process() {

        try {
          let now = new Date();

          await N.models.users.Ignore.deleteMany({ expire: { $lte: now } });
        } catch (err) {
          // don't propagate errors because we don't need automatic reloading
          N.logger.error('"%s" job error: %s', task_name, err.message || err);
        }
      }
    });
  });
};
