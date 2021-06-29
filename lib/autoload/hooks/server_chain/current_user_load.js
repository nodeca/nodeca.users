// Init session with users data or guest defaults.


'use strict';


const _               = require('lodash');
const userInfo        = require('nodeca.users/lib/user_info');
//const archive_session = require('nodeca.users/lib/archive_session');


module.exports = function (N) {

  // Load session from cookie by AuthSession.
  //
  N.wire.before('server_chain:*', { priority: -50 }, async function fill_session_from_AuthSession(env) {
    let sid = env.extras.getCookie('sid');

    // No session id.
    if (_.isEmpty(sid)) return;

    // all AuthSession sids should start with 'm'
    if (sid[0] !== 'm') return;

    let authSession = await N.models.users.AuthSession
                          .findOne({ session_id: sid })
                          .lean(true);

    // Session is not found.
    if (!authSession) return;

    // Core will set session_id to null if it creates a new session,
    // to create a new cookie/session id afterwards
    //
    // We want to preserve old cookie, so we reset this
    //
    env.session_id = sid;

    // Expire session after fixed amount of time after logging in,
    // Uses 'general_login_expire_days' global setting.
    //
    /*let expireDays = await N.settings.get('general_login_expire_days');

    if (expireDays > 0) {
      let now = Date.now();

      if (now > authSession.first_ts.valueOf() + expireDays * 24 * 60 * 60 * 1000) {
        // Login expired - unset user_id
        await archive_session(N, env.session_id, N.models.users.AuthSessionLog.logout_types.EXPIRED);
        env.session_id = null;
        return;
      }
    }*/

    // Fetch current user info.
    env.user_info = await userInfo(N, authSession.user);

    // Update session if browser info has changed
    let updateSession = {};

    //if (env.req.ip !== authSession.ip) {
    //  updateSession.ip = env.req.ip;
    //}

    //if (env.origin.req.headers['user-agent'] !== authSession.user_agent) {
    //  updateSession.ip = env.origin.req.headers['user-agent'];
    //}

    if (Date.now() - 60 * 1000 > authSession.last_ts) {
      //
      // only update last_ts if it differs by more than 1 minute,
      // it avoids frequent mongo updates
      //
      // TODO: maybe use last_active_update task instead of this
      //
      updateSession.last_ts = Date.now();
    }

    if (!_.isEmpty(updateSession)) {
      await N.models.users.AuthSession.updateOne(
        { session_id: sid },
        { $set: updateSession }
      );
    }
  });


  // Fetch guest's user info if no authorized user
  //
  N.wire.before('server_chain:*', { priority: -50 }, async function fetch_guest_user_info(env) {
    if (env.user_info) return;
    env.user_info = await userInfo(N, null);
  });


  // Fill user_info locale
  //
  N.wire.before('server_chain:*', { priority: -50 }, function fill_user_info_locale(env) {
    env.user_info.locale = env.user_info.locale || env.helpers.getLocale();
  });


  // Copy data from `env.user_info` to `env.runtime` for the browser
  //
  N.wire.after('server_chain:http:*', function fill_runtime_user_info(env) {
    Object.assign(env.runtime, _.pick(env.user_info, [
      'user_id',
      'user_hid',
      'user_name',
      'user_nick',
      'user_avatar',
      'is_member',
      'locale'
    ]));
  });


  require('nodeca.core/lib/system/env').cloneHandlers.push(function (target, source) {
    target.user_info = source.user_info;
  });
};
