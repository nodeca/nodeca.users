'use strict';


var ko          = require('knockout');


var view = null;


N.wire.on('navigate.done:' + module.apiPath, function setup_page() {
  view = { status: ko.observable(null) };
  ko.applyBindings(view, $('#content')[0]);
});


N.wire.on('navigate.exit:' + module.apiPath, function teardown_page() {
  ko.cleanNode($('#content')[0]);
  view = null;
});


N.wire.on('users.auth.reset_password.change_exec', function reset_password(form) {

  N.io.rpc('users.auth.reset_password.change_exec', form.fields, function (err) {
    if (err && N.io.CLIENT_ERROR === err.code) {
      view.status(err.bad_password ? 'error' : null);
      return;
    }

    if (err && err.message) {
      return false;
    }

    // Reload the page in order to apply auto login.
    window.location = N.runtime.router.linkTo('users.auth.reset_password.change_done_show');
  });
});
