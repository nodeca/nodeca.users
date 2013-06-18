// Set "since last visit" lifetime of session for logged in users using
// 'general_session_expire_hours' setting.


'use strict';


module.exports = function (N) {
  N.wire.before('server_chain:*', { priority: -50 }, function members_session_ttl(env, callback) {
    if (!env.session || !env.session.user_id) {
      // Not logged in.
      callback();
      return;
    }

    if (env.session_ttl) {
      // Custom TTL is already set by another hook.
      callback();
      return;
    }

    N.settings.get('general_session_expire_hours', {}, function (err, expireHours) {
      if (err) {
        callback(err);
        return;
      }

      if (0 === expireHours) {
        // Use default.
        callback();
        return;
      }

      env.session_ttl = expireHours * 60 * 60;
      callback();
    });
  });
};
