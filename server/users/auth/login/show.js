// Show login page.


'use strict';


var _ = require('lodash');


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
  N.wire.before(apiPath, function* save_redirect(env) {
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
    loginRedirect.ip  = env.req.ip;

    let res = yield loginRedirect.save();

    env.params.redirect_id = res._id;
  });


  // Fill head meta
  //
  N.wire.on(apiPath, function login_show(env) {
    env.res.head.title  = env.t('title');
    env.res.redirect_id = env.params.redirect_id;
  });


  // Fill oauth providers
  //
  N.wire.after(apiPath, function fill_head_and_breadcrumbs(env) {
    var oauth = {};
    var providers = N.config.oauth;

    _.forEach(providers, function (provider, name) {
      oauth[name] = provider.client;
    });

    _.set(env.res, 'blocks.oauth', oauth);
  });
};
