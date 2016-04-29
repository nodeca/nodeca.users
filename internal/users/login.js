// Update data to logged-in state:
//
// - recreate new session (change session id for security reasons)
// - fill redirection URL
// - log ip/time to AuthLink, been used for login
//
// Expects env.data filled with:
//
// - user
// - redirect_id (optional)
// - authLink
//
'use strict';


module.exports = function (N, apiPath) {

  N.wire.on(apiPath, function* user_internal_login(env) {

    // delete old session (don't wait until complete)
    if (env.session_id) {
      N.redis.del('sess:' + env.session_id);
    }

    let token = new N.models.users.TokenLogin({
      user:     env.data.user._id,
      ip:       env.req.ip,
      authlink: env.data.authLink._id
    });

    yield token.save();

    env.session_id      = token.session_id;

    // Attach user id to the existing session, while preserving existing
    // session data.
    //
    // So if something is saved for a guest, it'll still be available when
    // he logs in.
    //
    env.session.user_id = token.user.toString();

    // fill redirect with default value
    env.data.redirect_url = N.router.linkTo('users.member', { user_hid: env.data.user.hid });

    // if no specific redirect requested - redirect to default
    if (!env.data.redirect_id) return;

    // Try to find active redirect bound to this ip
    let link = yield N.models.users.LoginRedirect
                        .findOne({ _id: env.data.redirect_id, used: false, ip: env.req.ip })
                        .lean(true);

    // If redirect requested, but not found - redirect to default.
    if (!link) return;

    // update redirect url
    env.data.redirect_url = link.url;

    // mark redirect as used
    yield N.models.users.LoginRedirect
              .update({ _id: link._id }, { $set: { used: true } });
  });


  // Remember login ip and date in used AuthLink
  //
  N.wire.after(apiPath, function* remember_auth_data(env) {
    // authLink is not filled for (register + autologin)
    // Just skip update for this case.
    if (!env.data.authLink) return;

    yield N.models.users.AuthLink.update(
              { _id: env.data.authLink._id },
              { $set: { last_ts: Date.now(), last_ip: env.req.ip } });
  });
};
