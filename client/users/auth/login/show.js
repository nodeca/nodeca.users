// Login page logic
//
'use strict';


// Knockout view model of the page.
let view = null;


N.wire.on('navigate.preload:' + module.apiPath, function load_deps(preload) {
  preload.push('vendor.knockout');
});


// Page enter
//
N.wire.on('navigate.done:' + module.apiPath, function page_setup() {
  const ko = require('knockout');

  view = {
    error: ko.observable(null),

    recaptcha_response_field: {
      visible:  Boolean(N.runtime.recaptcha),
      error:    ko.observable(null)
    }
  };

  ko.applyBindings(view, $('#content')[0]);

  return N.wire.emit('common.blocks.recaptcha.create');
});


// Setup listeners
//
N.wire.once('navigate.done:' + module.apiPath, function page_once() {

  // Page exit
  //
  N.wire.on('navigate.exit:' + module.apiPath, function page_exit() {
    const ko = require('knockout');

    ko.cleanNode($('#content')[0]);
    view = null;
  });


  // Form submit
  //
  N.wire.on('users.auth.login.plain_exec', function login(form) {
    let loginParams = form.fields;

    return N.io.rpc('users.auth.login.plain_exec', loginParams)
      .then(function (res) {
        let route = N.router.match(res.redirect_url);

        if (!route) {
          window.location = '/';
          return;
        }

        // Check that previous page can be loaded, because it can return redirect or forbid access
        N.io.rpc(route.meta.methods.get, route.params, { handleAllErrors: true })
          .then(() => {
            // Navigate to previous page
            window.location = res.redirect_url;
          })
          .catch(() => {
            window.location = '/';
          });
      })
      .catch(err => {
        if (err.code === N.io.REDIRECT) {
          return N.wire.emit('navigate.to', err.head.Location);
        }

        // Force captcha on every attempt.
        N.wire.emit('common.blocks.recaptcha.update');

        // Non client error will be processed with default error handler
        if (err.code !== N.io.CLIENT_ERROR) throw err;

        view.error(err.message);
      });
  });
});
