// Request password change page logic
//

'use strict';


var ko = require('knockout');


var view = null;


// Page enter
//
N.wire.on('navigate.done:' + module.apiPath, function page_setup() {
  view = {
    message: ko.observable(null),

    recaptcha_response_field: {
      visible: Boolean(N.runtime.recaptcha),
      css:     '',
      message: null
    }
  };

  ko.applyBindings(view, $('#content')[0]);

  N.wire.emit('common.blocks.recaptcha.create');
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
  N.wire.on('users.auth.reset_password.request_exec', function request_reset(form) {

    N.io.rpc('users.auth.reset_password.request_exec', form.fields)
      .then(function () {
        N.wire.emit('navigate.to', { apiPath: 'users.auth.reset_password.request_done_show' });
      })
      .catch(function (err) {
        N.wire.emit('common.blocks.recaptcha.update');
        view.message(err.message);
      });
  });
});
