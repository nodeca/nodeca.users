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


  // This page is for guests only
  //
  N.wire.before(apiPath, function login_guest_only(env, callback) {
    N.wire.emit('internal:users.redirect_not_guest', env, callback);
  });


  // Check that requested redirect if valid
  //
  N.wire.before(apiPath, function login_check_redirect(env, callback) {

    // if no redirect id passed - skip checks
    if (!env.params.redirect_id) {
      callback();
      return;
    }

    N.models.users.LoginRedirect
        .findOne({ '_id': env.params.redirect_id })
        .lean(true)
        .exec(function (err, link) {

      if (err) {
        callback(err);
        return;
      }

      // redirect if passed id is not correct
      if (!link || link.used || !link.ip || link.ip !== env.req.ip) {
        callback({
          code: N.io.REDIRECT_PERMANENT,
          head: {
            'Location': N.runtime.router.linkTo('users.auth.login.show')
          }
        });
        return;
      }

      callback();
    });
  });


  // If page is requested too often, require to fill captcha.
  //
  // TODO: check if we should remember captcha requirement in session
  //
  N.wire.before(apiPath, function login_protect_with_captcha(env, callback) {
    rateLimit.total.check(function (err, isExceeded) {
      if (err) {
        callback(err);
        return;
      }

      env.res.captcha_required = isExceeded;
      callback();
    });
  });


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

    env.res.blocks.oauth = oauth;
  });
};
