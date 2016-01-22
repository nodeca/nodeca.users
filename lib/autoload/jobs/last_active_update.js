// Move last active timestamps from `users:last_active` in redis
// to `Users.last_active_ts` in mongo.
//
'use strict';


const ObjectId = require('mongoose').Types.ObjectId;


module.exports = function (N) {

  function process(callback) {
    let bulk = N.models.users.User.collection.initializeUnorderedBulkOp();

    N.redis.zrangebyscore('users:last_active', '-inf', '+inf', 'withscores', function (err, items) {
      if (err) {
        callback(err);
        return;
      }

      if (!items.length) {
        callback();
        return;
      }

      for (var i = 0; i < items.length; i += 2) {
        bulk.find({ _id: new ObjectId(items[i]) })
            .updateOne({ $set: { last_active_ts: new Date(Number(items[i + 1])) } });
      }

      bulk.execute(function () {
        if (err) {
          callback(err);
          return;
        }

        N.redis.zremrangebyscore('users:last_active', '-inf', items[items.length - 1], callback);
      });
    });
  }


  N.wire.on('init:jobs', function register_last_active_update() {
    const task_name = 'last_active_update';

    if (!N.config.cron || !N.config.cron[task_name]) {
      return new Error(`No config defined for cron task "${task_name}"`);
    }

    N.queue.registerWorker({
      name: task_name,
      cron: N.config.cron[task_name],
      process: function (callback) {
        process(function (err) {
          if (err) {
            // don't return an error in the callback because we don't need automatic reloading
            N.logger.error('"%s" job error: %s', task_name, err.message || err);
          }

          callback();
        });
      }
    });
  });
};
