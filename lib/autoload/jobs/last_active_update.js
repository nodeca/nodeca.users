// Move last active timestamps from `users:last_active` in redis
// to `Users.last_active_ts` in mongo.
//
'use strict';


const ObjectId = require('mongoose').Types.ObjectId;
const Promise  = require('bluebird');


module.exports = function (N) {
  N.wire.on('init:jobs', function register_last_active_update() {
    const task_name = 'last_active_update';

    if (!N.config.cron || !N.config.cron[task_name]) {
      return new Error(`No config defined for cron task "${task_name}"`);
    }

    N.queue.registerTask({
      name: task_name,
      cron: N.config.cron[task_name],
      process: Promise.coroutine(function* () {
        try {
          let items = yield N.redis.zrangebyscoreAsync('users:last_active', '-inf', '+inf', 'withscores');

          if (items.length) {
            let bulk = N.models.users.User.collection.initializeUnorderedBulkOp();

            for (let i = 0; i < items.length; i += 2) {
              bulk.find({ _id: new ObjectId(items[i]) })
                  .updateOne({ $set: { last_active_ts: new Date(Number(items[i + 1])) } });
            }

            yield bulk.execute();
            yield N.redis.zremrangebyscoreAsync('users:last_active', '-inf', items[items.length - 1]);
          }
        } catch (err) {
          // don't propagate errors because we don't need automatic reloading
          N.logger.error('"%s" job error: %s', task_name, err.message || err);
        }
      })
    });
  });
};
