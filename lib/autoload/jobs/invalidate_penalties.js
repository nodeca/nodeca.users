// Invalidate penalties
//
'use strict';


const Promise = require('bluebird');


module.exports = function (N) {
  N.wire.on('init:jobs', function register_invalidate_penalties() {
    const task_name = 'invalidate_penalties';

    if (!N.config.cron || !N.config.cron[task_name]) {
      return new Error(`No config defined for cron task "${task_name}"`);
    }

    N.queue.registerTask({
      name: task_name,
      cron: N.config.cron[task_name],
      process: Promise.coroutine(function* () {
        try {
          let now = new Date();

          // Fetch expired
          let expired_penalties = yield N.models.users.UserPenalty.find()
                                            .where('expire').lte(now)
                                            .lean(true);

          for (let i = 0; i < expired_penalties.length; i++) {
            let penalty = expired_penalties[i];

            // Subcall remove action for each expired penalty
            yield N.wire.emit(`internal:users.infraction.${penalty.type}.remove`, penalty);

            // Remove penalty
            yield N.models.users.UserPenalty.remove({ _id: penalty._id });
          }
        } catch (err) {
          // don't propagate errors because we don't need automatic reloading
          N.logger.error('"%s" job error: %s', task_name, err.message || err);
        }
      })
    });
  });
};
