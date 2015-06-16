// Init session with users data or guest defaults.


'use strict';


var _ = require('lodash');
var memoizee = require('memoizee');


module.exports = function (N) {

  // Find and cache usergroup ObjectId forever. Use only for 'protected' groups.
  //
  var findUsergroupId = memoizee(function (shortName, callback) {
    N.models.users.UserGroup.findIdByName(shortName, callback);
  }, { async: true });


  function initGuestSession(env, callback) {
    findUsergroupId('guests', function (err, guestsId) {
      if (err) {
        callback(err);
        return;
      }

      env.user_info = {};
      env.user_info.hb = false;
      env.user_info.is_guest = true;
      env.user_info.is_member = false;
      env.user_info.user_id = null;
      env.user_info.usergroups = [ guestsId ];
      env.user_info.locale = env.session.locale;

      // Fill user info for browser
      env.runtime.user_name = '';
      env.runtime.user_id = '000000000000000000000000';
      env.runtime.user_hid = 0;
      env.runtime.user_avatar = null;
      env.runtime.is_guest  = true;
      env.runtime.is_member = false;
      env.runtime.locale = env.session.locale;

      callback();
    });
  }


  // If session cookie exists, but session wasn't started from redis
  // previously, query mongodb and if this session id belongs to a user,
  // adds his info to a session.
  //
  // It could happen for example if redis session is expired.
  //
  N.wire.before('server_chain:*', { priority: -50 }, function fill_session_from_TokenLogin(env, callback) {
    if (env.session.user_id) {
      // user already loaded
      callback();
      return;
    }

    var sid = env.extras.getCookie('sid');

    if (_.isEmpty(sid)) {
      // No session id.
      callback();
      return;
    }

    N.models.users.TokenLogin
        .findOne({ session_id: sid })
        .select('_id user_id')
        .lean(true)
        .exec(function (err, token) {

      if (err) {
        callback(err);
        return;
      }

      if (!token) {
        // Session is not found.
        callback();
        return;
      }

      // Core will set session_id to null if it creates a new session,
      // to create a new cookie/session id afterwards
      //
      // We want to preserve old cookie, so we reset this
      //
      env.session_id = sid;

      env.session.user_id = token.user_id.toString();
      env.session.auth_ts = token._id.getTimestamp().valueOf();

      callback();
    });
  });


  // Expire session after fixed amount of time after logging in,
  // Uses 'general_login_expire_days' global setting.
  //
  N.wire.before('server_chain:*', { priority: -50 }, function check_session_token_expiration(env, callback) {
    if (!env.session) {
      // No session.
      callback();
      return;
    }

    N.settings.get('general_login_expire_days', function (err, expireDays) {
      if (err) {
        callback(err);
        return;
      }

      if (expireDays >= 0) {
        // No limitation for login lifetime.
        callback();
        return;
      }

      if (env.session.auth_ts && (Date.now() < (env.session.auth_ts + expireDays * 24 * 60 * 60 * 1000))) {
        // Login is still valid.
        callback();
        return;
      }

      // Login expired - unset user_id
      env.session_id = null;
      env.session.user_id = null;
      env.session.auth_ts = Date.now();
      callback();
    });
  });


  // Fetch current user info. Fired before each server handler.
  N.wire.before('server_chain:*', { priority: -50 }, function current_user_load(env, callback) {
    // Not logged in - initialize guest session.
    if (!env.session || !env.session.user_id) {
      initGuestSession(env, callback);
      return;
    }

    N.models.users.User
      .findById(env.session.user_id)
      .select('_id hid name usergroups locale hb avatar_id')
      .lean(true)
      .exec(function (err, user) {
        if (err) {
          callback(err);
          return;
        }

        // User was deleted while session is still active - reinit as a guest.
        if (!user) {
          initGuestSession(env, callback);
          return;
        }

        env.user_info = {};
        env.user_info.hb = user.hb;
        env.user_info.is_guest = false;
        env.user_info.is_member = true;
        env.user_info.user_id = String(user._id);
        env.user_info.usergroups = user.usergroups;
        env.user_info.locale = user.locale || env.session.locale;

        // Fill user info for browser
        env.runtime.user_name = user.name;
        env.runtime.user_id = String(user._id);
        env.runtime.user_hid = user.hid;
        env.runtime.user_avatar = user.avatar_id;
        env.runtime.is_guest  = false;
        env.runtime.is_member = true;
        env.runtime.locale = user.locale || env.session.locale;

        callback();
      });
  });
};
