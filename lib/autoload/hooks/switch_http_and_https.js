// Redirect between plain HTTP and encrypted HTTPS according to
// `general_ssl_mode` global setting.
//
// https_off: Force HTTP everywhere.
// https_always: Force HTTPS everywhere.
// https_members: Force HTTPS for users, and HTTP for guests.


'use strict';


var COOKIE_MAXAGE_LIKE_FOREVER = 10 * 365 * 24 * 60 * 60; // 10 years.
var COOKIE_EXPIRES_IN_THE_PAST = new Date('Thu, 01 Jan 1970 00:00:00 GMT');


module.exports = function (N) {

  function redirectToProtocol(env, protocol, callback) {
    var url = env.helpers.url_to(env.method, env.params, { protocol: protocol });

    if (!url) {
      // Can't build URL - usually RPC-only method.
      callback({
        code:    N.io.BAD_REQUEST
      , message: protocol + ' connection required'
      });
      return;
    }

    callback({
      code: N.io.REDIRECT
    , head: { Location: url }
    });
  }


  // Ensure HTTPS if "ssl" cookie is set *before* session load because
  // session id is stored as secure cookie - it's sent only over SSL.
  //
  N.wire.before('server_chain:*', { priority: -85 }, function force_members_https(env, callback) {
    if ('1' !== env.extras.getCookie('ssl')) {
      // No cookie - do nothing.
      callback();
      return;
    }

    if (env.request.isEncrypted) {
      // Already on SSL - do nothing.
      callback();
      return;
    }

    redirectToProtocol(env, 'https', callback);
  });


  // Common http -> https redirector. We use 'server:' channel here to allow
  // page-specific exceptions and additions to this rules. Like for auth pages.
  //
  N.wire.before('server:**', function force_https_to_http(env, callback) {
    if (!env.request.isEncrypted) {
      // Already on plain HTTP - do nothing.
      callback();
      return;
    }

    N.settings.get('general_ssl_mode', {}, function (err, mode) {
      if (err) {
        callback(err);
        return;
      }

      if ('https_always'  === mode ||
          'https_members' === mode && env.session && env.session.user_id) {
        // SSL is required in this case and user already uses it.
        callback();
        return;
      }

      redirectToProtocol(env, 'http', callback);
    });
  });


  // Common https -> http redirector. We use 'server:' channel here to allow
  // page-specific exceptions and additions to this rules. Like for auth pages.
  //
  N.wire.before('server:**', function force_http_to_https(env, callback) {
    if (env.request.isEncrypted) {
      // Already on SSL - do nothing.
      callback();
      return;
    }

    N.settings.get('general_ssl_mode', {}, function (err, mode) {
      if (err) {
        callback(err);
        return;
      }

      if ('https_off'     === mode ||
          'https_members' === mode && !(env.session && env.session.user_id)) {
        // SSL is not required in this case.
        callback();
        return;
      }

      redirectToProtocol(env, 'https', callback);
    });
  });


  // Special http/https redirection rules for login and register pages.
  //
  N.wire.skip('server:users.auth.check_nick',       'force_https_to_http');
  N.wire.skip('server:users.auth.login.show',       'force_https_to_http');
  N.wire.skip('server:users.auth.login.plain_exec', 'force_https_to_http');
  N.wire.skip('server:users.auth.register.show',    'force_https_to_http');
  N.wire.skip('server:users.auth.register.exec',    'force_https_to_http');

  N.wire.before([
    'server:users.auth.login.show'
  , 'server:users.auth.register.show'
  ], function force_https_on_auth(env, callback) {
    if (env.request.isEncrypted) {
      // Already encrypted - do nothing.
      callback();
      return;
    }

    N.settings.get('general_ssl_mode', {}, function (err, mode) {
      if (err) {
        callback(err);
        return;
      }

      if ('https_members' !== mode) {
        // Nothing to do.
        // 'https_always' option is served by 'force_http_to_https' hook.
        callback();
        return;
      }

      redirectToProtocol(env, 'https', callback);
    });
  });


  // Set cookie to keep secure connection for logged in users.
  //
  N.wire.after('server_chain:*', { priority: 80, ensure: true }, function set_ssl_redirect_cookie(env, callback) {
    N.settings.get('general_ssl_mode', {}, function (err, mode) {
      if (err) {
        callback(err);
        return;
      }

      if ('https_always'  === mode ||
          'https_members' === mode && env.session && env.session.user_id) {
        if ('1' !== env.extras.getCookie('ssl')) {
          // Add cookie for a HUGE amount of time.
          env.extras.setCookie('ssl', '1', { maxAge: COOKIE_MAXAGE_LIKE_FOREVER });
        }
      } else {
        if ('1' === env.extras.getCookie('ssl')) {
          // Delete cookie by setting 'expires' to a past date.
          env.extras.setCookie('ssl', '0', { expires: COOKIE_EXPIRES_IN_THE_PAST });
        }
      }
      callback();
    });
  });


  // Modify 'secure' flag of session id cookie.
  //
  N.wire.after('server_chain:*', { priority: 85, ensure: true }, function set_sid_cookie_mode(env, callback) {
    if (!env.extras.setCookie.storage['sid']) {
      // No session id cookie.
      callback();
      return;
    }

    N.settings.get('general_ssl_mode', {}, function (err, mode) {
      if (err) {
        callback(err);
        return;
      }

      // Small hack: access cookies storage directly to not blow up env with
      // case-specific functions like `updateCookie`.
      env.extras.setCookie.storage['sid'].options.secure =
        'https_always'  === mode ||
        'https_members' === mode && env.session && env.session.user_id;

      callback();
    });
  });
};
