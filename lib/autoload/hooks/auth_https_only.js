// Special HTTP/HTTPS redirection rules for login and register pages.
//
// - Skips HTTPS->HTTP redirection hook on login and register pages.
// - Redirects to HTTPS for cases that common HTTP->HTTPS redirector
//   does not cover, e.g. guest user on login page.
//
// NOTE: It requires 'http_and_https_switch.js' hooks file to be enabled.


'use strict';


module.exports = function (N) {
  N.wire.skip('server:users.auth.check_nick',       'http_force');
  N.wire.skip('server:users.auth.login.show',       'http_force');
  N.wire.skip('server:users.auth.login.plain_exec', 'http_force');
  N.wire.skip('server:users.auth.register.show',    'http_force');
  N.wire.skip('server:users.auth.register.exec',    'http_force');


  N.wire.before([
    'server:users.auth.login.show'
  , 'server:users.auth.register.show'
  ], { priority: -90 }, function https_auth_force(env, callback) {
    if (env.request.isEncrypted) {
      // Already encrypted - do nothing.
      callback();
      return;
    }

    N.settings.get('general_ssl_mode', function (err, mode) {
      if (err) {
        callback(err);
        return;
      }

      if ('https_members' !== mode) {
        // Nothing to do.
        // 'https_always' option is already handled by `https_force` hook.
        callback();
        return;
      }

      callback({
        code: N.io.REDIRECT
      , head: { Location: env.helpers.url_to(env.method, env.params, { protocol: 'https' }) }
      });
    });
  });
};
