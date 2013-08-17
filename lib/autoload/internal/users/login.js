// Apply login on current session and change session id for security reasons.


'use strict';


module.exports = function (N) {

  N.wire.on('internal:users.login', function (env) {

    // delete old session (don't wait until compleete)
    if (env.session_id) {
      N.runtime.redis.del('sess:' + env.session_id);
    }

    env.session_id      = null; // Generate new sid on session save.
    env.session.user_id = env.data.user._id.toString();
  });
};
