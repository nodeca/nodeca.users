// Render registration form


'use strict';

var _ = require('lodash');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});


  N.wire.before(apiPath, function register_guest_only(env, callback) {
    N.wire.emit('internal:users.redirect_not_guest', env, callback);
  });


  N.wire.on(apiPath, function fill_page_head(env) {
    env.res.head.title = env.t('title');
  });


  // Fill oauth providers
  //
  N.wire.after(apiPath, function fill_head_and_breadcrumbs(env) {

    var oauth = {};
    var providers = N.config.oauth;
    _.forEach(providers, function (provider, name) {
      oauth[name] = provider.client;
    });

    env.res.blocks.oauth = oauth;
  });
};
