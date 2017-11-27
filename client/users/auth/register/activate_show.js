// Activate account using code received in email
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

    return N.io.rpc('users.auth.register.activate_exec', data.fields)
      .then(() => {
        view.error(t('err_invalid_token'));
      }, err => {
        if (err.code === N.io.REDIRECT) {
          window.location = err.head.Location;
          return;
        }

        view.error(err.message);
      });
  });
});
