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


  // Check oauth email uniqueness
  //
  N.wire.after(apiPath, function fill_head_and_breadcrumbs(env, callback) {

    env.session.redirect_id = env.params.redirect_id;

    if (!env.session.oauth) {
      callback();  // No oauth data
      return;
    }

    N.models.users.AuthLink
        .findOne({ 'email' : env.session.oauth.email, 'exist': true })
        .lean(true)
        .exec(function (err, authlink) {

      if (err) {
        callback(err);
        return;
      }

      if (authlink) {
        callback({
          code: N.io.REDIRECT,
          head: {
            'Location': N.runtime.router.linkTo('users.auth.oauth.error_show')
          }
        });
        return;
      }

      callback();
    });
  });

  // Fill oauth providers
  //
  N.wire.after(apiPath, function fill_head_and_breadcrumbs(env) {

    env.session.redirect_id = env.params.redirect_id;

    if (env.session.oauth) {
      env.res.selected_provider = env.session.oauth.provider;
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
