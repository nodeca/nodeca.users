// Login page logic

'use strict';


var ko          = require('knockout');


// Knockout view model of the page.
var view = null;
var redirect_id;


// Page enter
//
N.wire.on('navigate.done:' + module.apiPath, function page_setup(data) {
  redirect_id = data.params.redirect_id;

  var captchaRequired = N.runtime.page_data.captcha_required;

  view = {
    message: ko.observable(null),

    recaptcha_response_field: {
      visible: ko.observable(captchaRequired),
      css:     '',
      message: null
    }
  };

  ko.applyBindings(view, $('#content')[0]);

  if (captchaRequired) {
    N.wire.emit('common.blocks.recaptcha.create');
  }
});


// Setup listeners
//
N.wire.once('navigate.done:' + module.apiPath, function page_init() {

  // Page exit
  //
  N.wire.on('navigate.exit:' + module.apiPath, function page_exit() {
    ko.cleanNode($('#content')[0]);
    view = null;
  });


  // Do login
  //
  N.wire.on('users.auth.login.plain_exec', function login(form) {
    var loginParams = form.fields;
    if (redirect_id) {
      loginParams.redirect_id = redirect_id;
    }

    N.io.rpc('users.auth.login.plain_exec', loginParams)
      .done(function (res) {
        window.location = res.redirect_url;
      })
      .fail(function (err) {
        if (err.captcha) {
          // If ReCaptcha is already created, just update it. Create otherwise.
          if (view.recaptcha_response_field.visible()) {
            N.wire.emit('common.blocks.recaptcha.update');
          } else {
            N.wire.emit('common.blocks.recaptcha.create');
          }
        }

        view.message(err.message);
        view.recaptcha_response_field.visible(err.captcha);
      });
  });
});
