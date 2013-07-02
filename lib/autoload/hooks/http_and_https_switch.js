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


  // Ensure HTTPS if "ssl" cookie is set *before* session load because
  // session id is stored as secure cookie - it's sent only over SSL.
  //
  N.wire.before('server_chain:*', { priority: -85 }, function https_members_force(env) {
    if ('1' !== env.extras.getCookie('ssl')) {
      // No cookie - do nothing.
      return;
    }

    if (env.request.isEncrypted) {
      // Already on SSL - do nothing.
      return;
    }

    return redirectToProtocol(env, 'https');
  });


  // Redirect to plain HTTP when `general_ssl_mode` is
  // - `https_off`
  // - `https_members` and user is *not* logged in.
  //
  // NOTE: We use 'server:' channel here to allow page-specific exceptions and
  // additions to this rules. Like for auth pages.
  //
  N.wire.before('server:*', { priority: -90 }, function http_force(env, callback) {
    if (!env.request.isEncrypted) {
      // Already on plain HTTP - do nothing.
      callback();
      return;
    }

    N.settings.get('general_ssl_mode', function (err, mode) {
      if (err) {
        callback(err);
        return;
      }

      if (('https_always'  === mode) ||
          ('https_members' === mode && env.session && env.session.user_id)) {
        // SSL is required in this case and user already uses it.
        callback();
        return;
      }

      callback(redirectToProtocol(env, 'http'));
    });
  });


  // Redirect to encrypted HTTPS when `general_ssl_mode` is
  // - `https_always`
  // - `https_members` and user is logged in.
  //
  // NOTE: We use 'server:' channel here to allow page-specific exceptions and
  // additions to this rules. Like for auth pages.
  //
  N.wire.before('server:*', { priority: -90 }, function https_force(env, callback) {
    if (env.request.isEncrypted) {
      // Already on SSL - do nothing.
      callback();
      return;
    }

    N.settings.get('general_ssl_mode', function (err, mode) {
      if (err) {
        callback(err);
        return;
      }

      if (('https_off'     === mode) ||
          ('https_members' === mode && !(env.session && env.session.user_id))) {
        // SSL is not required in this case.
        callback();
        return;
      }

      callback(redirectToProtocol(env, 'https'));
    });
  });


  // Set cookie to keep secure connection for logged in users.
  //
  N.wire.after('server_chain:*', { priority: 80, ensure: true }, function ssl_cookie_set(env, callback) {
    N.settings.get('general_ssl_mode', function (err, mode) {
      if (err) {
        callback(err);
        return;
      }

      if (('https_always'  === mode) ||
          ('https_members' === mode && env.session && env.session.user_id)) {
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
  N.wire.after('server_chain:*', { priority: 85, ensure: true }, function session_cookie_secure(env, callback) {
    if (!env.extras.setCookie.storage['sid']) {
      // No session id cookie.
      callback();
      return;
    }

    N.settings.get('general_ssl_mode', function (err, mode) {
      if (err) {
        callback(err);
        return;
      }

      // Small hack: access cookies storage directly to not blow up env with
      // case-specific functions like `updateCookie`.
      env.extras.setCookie.storage['sid'].options.secure =
        (('https_always'  === mode) ||
         ('https_members' === mode && env.session && env.session.user_id));

      callback();
    });
  });
};
