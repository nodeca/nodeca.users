// Show login page.


'use strict';


var _ = require('lodash');


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    redirect_id: { format: 'mongo' }
  });


  // Kick logged-in members
  //
  N.wire.before(apiPath, function login_guest_only(env, callback) {
    N.wire.emit('internal:users.redirect_not_guest', env, callback);
  });


  // Fill head meta
  //
  N.wire.on(apiPath, function login_show(env) {
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

    _.set(env.res, 'blocks.oauth', oauth);
  });
};
