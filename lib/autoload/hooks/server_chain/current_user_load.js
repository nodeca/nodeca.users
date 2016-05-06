// Init session with users data or guest defaults.


'use strict';


var _        = require('lodash');
var userInfo = require('nodeca.users/lib/user_info');


module.exports = function (N) {

  // If session cookie exists, but session wasn't started from redis
  // previously, query mongodb and if this session id belongs to a user,
  // adds his info to a session.
  //
  // It could happen for example if redis session is expired.
  //
  N.wire.before('server_chain:*', { priority: -50 }, function* fill_session_from_TokenLogin(env) {
    // user already loaded
    if (env.session.user_id) return;

    var sid = env.extras.getCookie('sid');

    // No session id.
    if (_.isEmpty(sid)) return;

    let token = yield N.models.users.TokenLogin
                          .findOne({ session_id: sid })
                          .select('_id user')
                          .lean(true);
    // Session is not found.
    if (!token) return;

    // Core will set session_id to null if it creates a new session,
    // to create a new cookie/session id afterwards
    //
    // We want to preserve old cookie, so we reset this
    //
    env.session_id = sid;

    env.session.user_id = token.user.toString();
    env.session.auth_ts = token._id.getTimestamp().valueOf();
  });


  // Expire session after fixed amount of time after logging in,
  // Uses 'general_login_expire_days' global setting.
  //
  N.wire.before('server_chain:*', { priority: -50 }, function* check_session_token_expiration(env) {
    // No session.
    if (!env.session) return;

    let expireDays = yield N.settings.get('general_login_expire_days');

    // No limitation for login lifetime.
    if (expireDays >= 0) return;

    if (env.session.auth_ts && (Date.now() < (env.session.auth_ts + expireDays * 24 * 60 * 60 * 1000))) {
      // Login is still valid.
      return;
    }

    // Login expired - unset user_id
    env.session_id = null;
    env.session.user_id = null;
    env.session.auth_ts = Date.now();
  });


  // Fetch current user info. Fired before each server handler.
  //
  N.wire.before('server_chain:*', { priority: -50 }, function* current_user_load(env) {
    env.user_info = yield userInfo(N, env.session ? env.session.user_id : null);
  });


  // Fill user_info locale
  //
  N.wire.before('server_chain:*', { priority: -50 }, function fill_user_info_locale(env) {
    env.user_info.locale = env.user_info.locale || env.helpers.getLocale();
  });


  // Copy data from `env.user_info` to `env.runtime` for the browser
  //
  N.wire.after('server_chain:http:*', function fill_runtime_user_info(env) {
    _.assign(env.runtime, _.pick(env.user_info, [
      'user_id',
      'user_hid',
      'user_name',
      'user_avatar',
      'is_guest',
      'is_member',
      'locale'
    ]));
  });


  require('nodeca.core/lib/system/env').cloneHandlers.push(function (target, source) {
    target.user_info = source.user_info;
  });
};
