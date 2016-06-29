// Enter new password page logic
//
'use strict';


const ko = require('knockout');


let view = null;


// Page enter
//
N.wire.on('navigate.done:' + module.apiPath, function page_setup() {
  view = { hasError: ko.observable(false) };
  ko.applyBindings(view, $('#content')[0]);
});


// Setup listeners
//
N.wire.once('navigate.done:' + module.apiPath, function page_once() {

  // Page exit
  //
  N.wire.on('navigate.exit:' + module.apiPath, function page_exit() {
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
        view.hasError(err.bad_password);
      });
  });
});
