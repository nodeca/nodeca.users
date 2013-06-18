// Apply login on current session and change session id for security reasons.


'use strict';


module.exports = function login(env, userId) {
  env.session_id      = null; // Generate new sid on session save.
  env.session.user_id = userId;
};
