// Update user's last activity time in redis. Field `User.last_active_ts` will be updated via cron.
//


'use strict';



module.exports = function (N) {

  // Update last activity time.
  //
  // This handler is synchronous, so redis won't delay server_chain execution
  //
  N.wire.after('server_chain:*', { priority: 80 }, function last_active_update(env) {
    // Not logged in - skip time update.
    if (!env.user_info.is_member) return;

    N.redis.time(function (err, time) {
      if (err) {
        N.logger.error('Redis error: %s', err.message || err);
        return;
      }

      N.redis.zadd('users:last_active', Math.floor(time[0] * 1000 + time[1] / 1000), env.user_info.user_id);
    });
  });
};
