// Update user's last activity time in redis. Field `User.last_active_ts` will be updated via cron.
//


'use strict';



module.exports = function (N) {

  // Update last activity time. Fired before each server handler.
  //
  N.wire.before('server_chain:*', function last_active_update(env, callback) {
    // Not logged in - skip time update.
    if (env.user_info.is_guest) {
      callback();
      return;
    }

    N.redis.time(function (err, time) {
      if (err) {
        callback(err);
        return;
      }

      N.redis.zadd('users:last_active', Math.floor(time[0] * 1000 + time[1] / 1000), env.user_info.user_id, callback);
    });
  });
};
