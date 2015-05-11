// Move last active timestamps from `users:last_active` in redis
// to `Users.last_active_ts` in mongo.
//
'use strict';


var ObjectId = require('mongoose').Types.ObjectId;


module.exports = function (N) {

  function process(callback) {
    var bulk = N.models.users.User.collection.initializeUnorderedBulkOp();

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
    N.queue.registerWorker({
      name: 'last_active_update',
      cron: N.config.cron ? N.config.cron.last_active_update : null,
      process: function (__, callback) {
        process(function (err) {
          if (err) {
            // don't return an error in the callback because we don't need automatic reloading
            N.logger.error('last_active_update job error: %s', err.message || err);
          }

          callback();
        });
      }
    });
  });
};
