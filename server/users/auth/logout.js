// Do logout


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function* logout(env) {
    if (!env.session_id) return;

    // Delete session from redis first, because otherwise in case of failure
    // users can still log in using this session even if a mongo token is gone
    // (and clearing all tokens in mongo afterwards won't affect this session).
    //
    yield N.redis.delAsync('sess:' + env.session_id);

    yield N.models.users.TokenLogin.remove({ session_id: env.session_id });

    // Repeat session deletion, because session might be restored in the time
    // between redis and mongo calls above (e.g. race condition with a parallel
    // request).
    //
    yield N.redis.delAsync('sess:' + env.session_id);

    // If there are no errors, we can finally set session to null,
    // so core could reset user cookie
    //
    env.session = null;
  });
};
