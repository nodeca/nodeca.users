// Redirect from HTTP to HTTPS when `general_ssl_force` on

'use strict';


module.exports = function (N) {

  function redirectToProtocol(env, protocol) {
    var url = env.helpers.url_to(env.method, env.params, { protocol: protocol });

    if (!url) {
      // Can't build URL - usually RPC-only method.
      return {
        code:    N.io.BAD_REQUEST
      , message: protocol + ' connection required'
      };
    }

    return {
      code: N.io.REDIRECT
    , head: { Location: url }
    };
  }


  // Redirect to encrypted HTTPS when `general_ssl_force` is true
  //
  N.wire.before('server_chain:*', { priority: -60 }, function https_force(env, callback) {
    if (env.req.isEncrypted) {
      // Already on SSL - do nothing.
      callback();
      return;
    }

    N.settings.get('general_ssl_force', function (err, general_ssl_force) {
      if (err) {
        callback(err);
        return;
      }

      if (!general_ssl_force) {
        // SSL is not required in this case.
        callback();
        return;
      }

      callback(redirectToProtocol(env, 'https'));
    });
  });
};
