// Do logout


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function logout(env, callback) {
    if (!env.session_id) {
      callback();
      return;
    }

    // Delete session from redis first, because otherwise in case of failure
    // users can still log in using this session even if a mongo token is gone
    //
    N.redis.del('sess:' + env.session_id, function (err) {
      if (err) {
        callback(err);
        return;
      }

      N.models.users.TokenLogin.remove({ session_id: env.session_id }, function (err) {
        if (err) {
          callback(err);
          return;
        }

        // If there are no errors, we can finally set session to null,
        // so core could reset user cookie
        //
        env.session = null;

        callback();
      });
    });
  });
};
