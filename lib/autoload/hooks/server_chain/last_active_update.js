// Update user's last activity time in redis. Field `User.last_active_ts` will be updated via cron.
//
// TODO: implement cron task


'use strict';



module.exports = function (N) {

  // Update last activity time. Fired before each server handler.
  //
  N.wire.before('server_chain:*', { priority: -55 }, function current_user_load(env, callback) {
    // Not logged in - skip time update.
    if (env.user_info.is_guest) {
      callback();
      return;
    }

    N.redis.zadd('users:last_active', Date.now(), env.session.user_id, callback);
  });
};
