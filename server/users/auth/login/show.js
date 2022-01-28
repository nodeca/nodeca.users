// Show login page.


'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    redirect_id: { format: 'mongo' }
  });


  // Kick logged-in members
  //
  N.wire.before(apiPath, function login_guest_only(env) {
    return N.wire.emit('internal:users.redirect_not_guest', env);
  });


  // Save referrer as link to redirect after login
  //
  //  - if redirect_id is not set, it means user moved to login page himself,
  //    so we can retrieve return url from referrer.
  //
  //  - if redirect_id is set, it means user was previously forced onto login
  //    page from restricted area (dialogs, tracker, etc.), do nothing in
  //    this case.
  //
  N.wire.before(apiPath, async function save_redirect(env) {
    if (env.params.redirect_id) return;

    let referer = env.origin.req.headers.referer;
    if (!referer) return;

    // check that referer contains a valid local url
    let route = N.router.match(referer);
    if (!route) return;

    // create a new url to make sure it won't contain anything router can't
    // make (e.g. #hash'es)
    let url = N.router.linkTo(route.meta.methods.get, route.params);
    if (!url) return;

    let loginRedirect = new N.models.users.LoginRedirect();

    loginRedirect.url = url;
    loginRedirect.session_id = env.session_id;

    let res = await loginRedirect.save();

    env.params.redirect_id = res._id;
  });


  // Fill head meta
  //
  N.wire.on(apiPath, function login_show(env) {
    env.res.head.title  = env.t('title');
    env.res.redirect_id = env.params.redirect_id;
  });
};
