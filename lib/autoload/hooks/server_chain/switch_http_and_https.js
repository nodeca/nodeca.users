// Redirect between plain HTTP and encrypted HTTPS according to
// `general_ssl_mode` global setting.
//
// https_off: Force HTTP everywhere.
// https_always: Force HTTPS everywhere.
// https_members: Force HTTPS for users, and HTTP for guests.


'use strict';


var COOKIE_MAXAGE_LIKE_FOREVER = 0xFFFFFFFF;
var COOKIE_EXPIRES_IN_THE_PAST = new Date('Thu, 01 Jan 1970 00:00:00 GMT');


module.exports = function (N) {

  // Ensure HTTPS if "ssl" cookie is set *before* session load because
  // session id is stored as secure cookie - it's sent only over SSL.
  N.wire.before('server_chain:*', { priority: -85 }, function force_members_https(env) {
    if ('1' !== env.extras.getCookie('ssl')) {
      // No cookie - do nothing.
      return;
    }

    if (env.request.isEncrypted) {
      // Already on SSL - do nothing.
      return;
    }

    var redirectUrl = env.helpers.url_to(env.method, env.params, { protocol: 'https' });

    if (!redirectUrl) {
      // Can't build URL - usually RPC-only method.
      return {
        code: N.io.BAD_REQUEST
      , message: 'Encrypted connection required'
      };
    }

    return {
      code: N.io.REDIRECT
    , head: { Location: redirectUrl }
    };
  });

  // Helper to read "general_ssl_mode" setting used by next hooks.
  // If `pageCheck` is true, page-specific encryption status is included.
  function isEncryptionRequired(env, pageCheck, callback) {
    N.settings.get('general_ssl_mode', {}, function (err, mode) {
      if (err) {
        callback(err);
        return;
      }

      switch (mode) {
      case 'https_off':
        callback(null, false);
        return;

      case 'https_always':
        callback(null, true);
        return;

      case 'https_members':
        if (pageCheck && 'users.auth' === env.method.slice(0, 'users.auth'.length)) {
          // force true even for guests at login/register page
          callback(null, true);
        } else {
          callback(null, Boolean(env.session && env.session.user_id));
        }
        return;

      default:
        // Case for broken settings store.
        callback('Value of setting "general_ssl_mode" is unknown: ' +
                 JSON.stringify(mode));
        return;
      }
    });
  }


  // Main guest/user http/https redirector. Just after session load.
  N.wire.before('server_chain:*', { priority: -75 }, function switch_http_and_https(env, callback) {
    isEncryptionRequired(env, true, function (err, shouldBeEncrypted) {
      if (err) {
        callback(err);
        return;
      }

      if (env.request.isEncrypted === shouldBeEncrypted) {
        // Redirection is not needed. Continue.
        callback();
        return;
      }

      var redirectUrl = env.helpers.url_to(env.method, env.params, {
        protocol: shouldBeEncrypted ? 'https' : 'http'
      });

      if (!redirectUrl) {
        // Can't build URL - usually RPC-only method.
        callback({
          code: N.io.BAD_REQUEST
        , message: 'Encrypted connection required'
        });
        return;
      }

      callback({
        code: N.io.REDIRECT
      , head: { Location: redirectUrl }
      });
    });
  });


  // Set cookie to keep secure connection for logged in users.
  N.wire.after('server_chain:*', { priority: 80, ensure: true }, function set_ssl_redirect_cookie(env, callback) {
    isEncryptionRequired(env, false, function (err, shouldBeEncrypted) {
      if (err) {
        callback(err);
        return;
      }

      if (shouldBeEncrypted) {
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
  N.wire.after('server_chain:*', { priority: 85, ensure: true }, function set_sid_cookie_mode(env, callback) {
    if (!env.extras.setCookie.storage['sid']) {
      // No session id cookie.
      callback();
      return;
    }

    isEncryptionRequired(env, false, function (err, shouldBeEncrypted) {
      if (err) {
        callback(err);
        return;
      }

      // Small hack: access cookies storage directly to not blow up env with
      // case-specific functions like `updateCookie`.
      env.extras.setCookie.storage['sid'].options.secure = shouldBeEncrypted;
      callback();
    });
  });
};
