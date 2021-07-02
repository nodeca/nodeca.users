// Infraction reply form
//

'use strict';


let view = null;


// View model for editable fields of the form
//
function Control() {
  const ko = require('knockout');

  this.error    = ko.observable(null);
  this.value    = ko.observable('');
}


N.wire.on('navigate.preload:' + module.apiPath, function load_deps(preload) {
  preload.push('vendor.knockout');
});


// Page enter
//
N.wire.on('navigate.done:' + module.apiPath, function page_setup() {
  const ko = require('knockout');

  // Root view model.
  view = {};
  view.message = new Control();
  view.submitted = ko.observable(false);
  view.error = ko.observable(null);

  // Apply root view model.
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
  N.wire.on(module.apiPath + ':submit', function submit(form) {

    return N.io.rpc('users.infraction_ask_about.exec', form.fields)
      .then(() => {
        view.submitted(true);
      })
      .catch(err => {
        // Non client error will be processed with default error handler
        if (err.code !== N.io.CLIENT_ERROR) throw err;

        // Update classes and messages on all input fields.
        for (let [ name, field ] of Object.entries(view)) {
          if (name === 'submitted') continue;
          if (name === 'error') continue;

          field.error(err.data?.name);
        }

        view.error(err.message);
      });
  });
});
