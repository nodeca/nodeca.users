// Update data to logged-in state:
//
// - recreate new session (change session id for security reasons)
// - fill redirection URL
// - log ip/time to AuthProvider, been used for login
//
// Expects env.data filled with:
//
// - user
// - redirect_id (optional)
// - authProvider
//
'use strict';


module.exports = function (N, apiPath) {

  // Forbid login for bots
  //
  N.wire.before(apiPath, async function check_usergroup(env) {
    if (!env.data.user) return;

    let is_bot = await N.settings.get('is_bot', {
      user_id: env.data.user._id,
      usergroup_ids: env.data.user.usergroups
    }, {});

    if (is_bot) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('@users.auth.login.plain_exec.err_login_failed')
      };
    }
  });


  N.wire.on(apiPath, async function user_internal_login(env) {

    // delete old session (don't wait until complete)
    if (env.session_id) {
      N.redis.del('sess:' + env.session_id);
    }

    let authSession = new N.models.users.AuthSession({
      user:         env.data.user._id,
      ip:           env.req.ip,
      user_agent:   env.origin.req.headers['user-agent'],
      authprovider: env.data.authProvider._id
    });

    await authSession.save();

    env.session_id = authSession.session_id;

    // force all other tabs to reload
    env.extras.setCookie('reload_tabs', 1, { httpOnly: false });

    // fill redirect with default value
    env.data.redirect_url = N.router.linkTo('users.member', { user_hid: env.data.user.hid });

    // if no specific redirect requested - redirect to default
    if (!env.data.redirect_id) return;

    // Try to find active redirect bound to this ip
    let link = await N.models.users.LoginRedirect
                        .findOne({ _id: env.data.redirect_id, used: false, ip: env.req.ip })
                        .lean(true);

    // If redirect requested, but not found - redirect to default.
    if (!link) return;

    // update redirect url
    env.data.redirect_url = link.url;

    // mark redirect as used
    await N.models.users.LoginRedirect
              .update({ _id: link._id }, { $set: { used: true } });
  });


  // Remember login ip and date in used AuthProvider
  //
  N.wire.after(apiPath, async function remember_auth_data(env) {
    // authProvider is not filled for (register + autologin)
    // Just skip update for this case.
    if (!env.data.authProvider) return;

    await N.models.users.AuthProvider.update(
              { _id: env.data.authProvider._id },
              { $set: { last_ts: Date.now(), last_ip: env.req.ip } });
  });
};
