// Enter new password page logic
//


'use strict';


var ko = require('knockout');


var view = null;


// Page enter
//
N.wire.on('navigate.done:' + module.apiPath, function page_setup() {
  view = { status: ko.observable(null) };
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
  N.wire.on('users.auth.reset_password.change_exec', function change_password(form) {

    N.io.rpc('users.auth.reset_password.change_exec', form.fields)
      .done(function () {
        // Reload the page in order to apply auto login.
        window.location = N.router.linkTo('users.auth.reset_password.change_done_show');
      })
      .fail(function (err) {
        view.status(err.bad_password ? 'has-error' : null);
      });
  });
});
