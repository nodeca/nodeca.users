// Apply login on current session and change session id for security reasons.


'use strict';


var rnd = require('nodeca.core/lib/rnd');


module.exports = function login(env, userId) {
  env.session.user_id = userId;
  env.origin.req.sid = rnd(); // Generate cryptostrong random hex string.
};
