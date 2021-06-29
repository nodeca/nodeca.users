// Show registration form


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});


  // Kick logged-in members
  //
  N.wire.before(apiPath, function register_guest_only(env) {
    return N.wire.emit('internal:users.redirect_not_guest', env);
  });


  // Fill page meta
  //
  N.wire.on(apiPath, function fill_page_head(env) {
    env.res.head.title = env.t('title');
  });


  // Fill oauth providers list & active one (if used to authenticate)
  //
  N.wire.after(apiPath, function fill_head_and_breadcrumbs(env) {

    // If user logged in via oauth, prefill email and oauth status
    if (env.session.oauth?.info) {
      env.res.oauth_active = env.session.oauth.info.provider;
      env.res.email = env.session.oauth.info.email;
    }

    let providers = N.config.oauth || {};

    env.res.oauth = {};

    Object.keys(providers, function (name) {
      env.res.oauth[name] = providers[name].client;
    });
  });
};
