// Render registration form


'use strict';

var _ = require('lodash');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});


  // Kick logged-in members
  //
  N.wire.before(apiPath, function register_guest_only(env, callback) {
    N.wire.emit('internal:users.redirect_not_guest', env, callback);
  });


  // Fill page meta
  //
  N.wire.on(apiPath, function fill_page_head(env) {
    env.res.head.title = env.t('title');
  });


  // Fill oauth providers list & active one (if used to authenticate)
  //
  N.wire.after(apiPath, function fill_head_and_breadcrumbs(env) {

    if (env.session.oauth) {
      env.res.auth_active = env.session.oauth.provider;
      env.res.email = env.session.oauth.email;
    }

    var oauth = {};
    var providers = N.config.oauth;
    _.forEach(providers, function (provider, name) {
      oauth[name] = provider.client;
    });

    env.res.blocks.oauth = oauth;
  });
};
