// Request password change page logic
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
  N.wire.on('users.auth.reset_password.request_exec', function request_reset(form) {

    return N.io.rpc('users.auth.reset_password.request_exec', form.fields)
      .then(() => N.wire.emit('navigate.to', { apiPath: 'users.auth.reset_password.request_done_show' }))
      .catch(err => {
        // Non client error will be processed with default error handler
        if (err.code !== N.io.CLIENT_ERROR) throw err;

        N.wire.emit('common.blocks.recaptcha.update');
        view.error(err.message);
      });
  });
});
