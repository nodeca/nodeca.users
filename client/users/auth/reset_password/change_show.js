// Enter new password page logic
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

  view = {};

  view.hasError = ko.observable(false);
  view.message  = ko.observable(null);
  view.help     = ko.computed(() => view.message() || t('password_help'));

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
  N.wire.on('users.auth.reset_password.change_exec', function change_password(data) {

    return N.io.rpc('users.auth.reset_password.change_exec', data.fields)
      .then(() => {
        // Reload the page in order to apply auto login.
        window.location = N.router.linkTo('users.auth.reset_password.change_done_show');
      })
      .catch(err => {
        view.hasError(err.bad_password || err.message);
        view.message(err.message);
      });
  });
});
