// Registration page form logic
//
'use strict';


const _  = require('lodash');

const CHECK_NICK_DELAY = 1000;


let view = null;


// View model for editable fields of the form: email, pass and nick.
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
  view = {
    email: new Control(),
    pass:  new Control(),
    nick:  new Control(),

    recaptcha_response_field: {
      visible:  Boolean(N.runtime.recaptcha),
      error:    ko.observable(null)
    }
  };

  if (N.runtime.page_data.email) {
    view.email.value(N.runtime.page_data.email);
  }

  // Reset nick CSS class and message on every change.
  view.nick.value.subscribe(() => {
    view.nick.error(null);
  });

  // Setup automatic nick validation on input.
  view.nick.value.subscribe(_.debounce(text => {
    if (text.length < 1) return;

    N.io.rpc('users.auth.check_nick', { nick: text })
      .then(res => {
        view.nick.error(res.error ? res.message : null);
      });
  }, CHECK_NICK_DELAY));

  // Apply root view model.
  ko.applyBindings(view, $('#content')[0]);

  // Init ReCaptcha.
  N.wire.emit('common.blocks.recaptcha.create');
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
  N.wire.on('users.auth.register.exec', function register(form) {

    return N.io.rpc('users.auth.register.exec', form.fields)
      .then(res => {
        if (N.router.match(res.redirect_url)?.meta.methods.get !== 'users.auth.register.activate_show') {
          // reload all other tabs if user registered and no confirmation was required
          N.broadcast.send('local.users.auth');
        }

        // Full page reload, because environment changed
        window.location = res.redirect_url;
      })
      .catch(err => {
        // Non client error will be processed with default error handler
        if (err.code !== N.io.CLIENT_ERROR) throw err;

        // Update classes and messages on all input fields.
        for (let [ name, field ] of Object.entries(view)) {
          field.error(err.data[name]);
        }

        // Update ReCaptcha if there is a ReCaptcha error.
        if (Object.prototype.hasOwnProperty.call(err.data, 'recaptcha_response_field')) {
          N.wire.emit('common.blocks.recaptcha.update');
        }
      });
  });
});
