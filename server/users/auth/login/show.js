// Show login form.


'use strict';

var _ = require('lodash');


module.exports = function (N, apiPath) {
  var rateLimit = require('./_rate_limit')(N);


  N.validate(apiPath, {
    redirect_id: {
      format: 'mongo'
    }
  });


  N.wire.before(apiPath, function login_guest_only(env, callback) {
    N.wire.emit('internal:users.redirect_not_guest', env, callback);
  });


  N.wire.on(apiPath, function login_show(env, callback) {
    env.res.head.title = env.t('title');

    rateLimit.total.check(function (err, isExceeded) {
      if (err) {
        callback(err);
        return;
      }

      env.res.captcha_required = isExceeded;
      callback();
    });
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
