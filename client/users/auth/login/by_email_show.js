// Log in using code received in email
//
'use strict';


let view = null;


N.wire.on('navigate.preload:' + module.apiPath, function load_deps(preload) {
  preload.push('vendor.knockout');
});


// Page enter
//
N.wire.on('navigate.done:' + module.apiPath, function page_setup() {
  const ko = require('knockout');

  view = {
    error: ko.observable(null)
  };

  ko.applyBindings(view, $('#content')[0]);
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
  N.wire.on(module.apiPath + ':submit', function submit_code(data) {
    if (!data.fields.secret_key_or_code) {
      view.error(null);
      return;
    }

    return N.io.rpc('users.auth.login.by_email_code', data.fields)
      .catch(err => {
        if (err.code === N.io.REDIRECT) {
          // reload all other tabs if user logged in using email+code
          N.broadcast.send('local.users.auth');

          window.location = err.head.Location;
          return;
        }

        // Non client error will be processed with default error handler
        if (err.code !== N.io.CLIENT_ERROR) throw err;

        view.error(err.message);
      });
  });
});
