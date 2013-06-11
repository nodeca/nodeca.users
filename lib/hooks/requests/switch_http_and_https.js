// Redirect between plain HTTP and encrypted HTTPS by following rules:
// - If user is logged in - force HTTPS.
// - If user is visiting "users.auth.*" page - force HTTPS.
// - Otherwise force HTTP.


'use strict';


var isEncryptionAllowed = require('nodeca.core/lib/system/utils/is_encryption_allowed');


module.exports = function (N) {
  N.wire.before('server_chain:*', { priority: -75 }, function switch_http_and_https(env) {
    var shouldBeEncrypted = Boolean(env.session.user_id) ||
                            'users.auth' === env.method.slice(0, 'users.auth'.length);

    if (env.request.isEncrypted === shouldBeEncrypted) {
      return; // Redirection is not needed. Continue.
    }

    if (!isEncryptionAllowed(N, env.method)) {
      return; // It is not possible to encrypt current connection.
    }

    var redirectUrl = env.url_to(env.method, env.params, {
      protocol: shouldBeEncrypted ? 'https' : 'http'
    });

    if (!redirectUrl) {
      // Can't build URL - usually RPC-only method.
      return { code: N.io.BAD_REQUEST, message: 'Encrypted connection is required' };
    }

    return { code: N.io.REDIRECT, head: { Location: redirectUrl } };
  });
};
