// Redirect guests to login page with back url id (fetched from server method)
'use strict';


module.exports = function (N, apiPath) {

  function createRedirect(redirectId) {
    let loginParams = redirectId ? { redirect_id: redirectId } : {};

    return {
      code: N.io.REDIRECT,
      head: {
        Location: N.router.linkTo('users.auth.login.show', loginParams)
      }
    };
  }

  N.wire.on(apiPath, async function force_login_guest(env) {
    if (env.user_info.is_member) return;

    let backUrl = N.router.linkTo(env.method, env.params);

    // Should never happens. Can't build url - just redirect to login page
    if (!backUrl) throw createRedirect();

    // There can be a second redirect (from http to https), but we can't cut
    // protocol because in dev environment we have different ports for http
    // and https

    let loginRedirect = new N.models.users.LoginRedirect();

    loginRedirect.url = backUrl;
    loginRedirect.session_id = env.session_id;

    let res = await loginRedirect.save();

    // Redirect to login page with id of url (of target page)
    throw createRedirect(res._id);
  });
};
