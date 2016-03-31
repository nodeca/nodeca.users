// Invalidate penalties
//
'use strict';


const _ = require('lodash');


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
          let rule_actions = _.map((N.config.users.infractions.penalties || []), 'action');

          for (let i = 0; i < rule_actions.length; i++) {
            yield N.wire.emit(`internal:users.infraction.${rule_actions[i]}.remove`);
          }
          // Subcall
        } catch (err) {
          // don't propagate errors because we don't need automatic reloading
          N.logger.error('"%s" job error: %s', task_name, err.message || err);
        }
      }
    });
  });
};
