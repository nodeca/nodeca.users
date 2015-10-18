// Login page logic

'use strict';


var ko      = require('knockout');


// Knockout view model of the page.
var view = null;
var redirectId;
var previousPageParams = null;


// Global listener to save previous page params
//
N.wire.on('navigate.exit', function save_previous_page_params(data) {
  previousPageParams = data;
});


// Page enter
//
N.wire.on('navigate.done:' + module.apiPath, function page_setup(data) {
  redirectId = data.params.redirect_id;

  var captchaRequired = N.runtime.page_data.captcha_required;

  view = {
    message: ko.observable(null),

    recaptcha_response_field: {
      visible: ko.observable(N.runtime.recaptcha && captchaRequired),
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
N.wire.once('navigate.done:' + module.apiPath, function page_once() {

  // Page exit
  //
  N.wire.on('navigate.exit:' + module.apiPath, function page_exit() {
    ko.cleanNode($('#content')[0]);
    view = null;
  });


  // Form submit
  //
  N.wire.on('users.auth.login.plain_exec', function login(form) {
    var loginParams = form.fields;

    if (redirectId) {
      loginParams.redirect_id = redirectId;
    }

    N.io.rpc('users.auth.login.plain_exec', loginParams)
      .done(function (res) {

        // Notify other browser tabs about
        N.live.emit('local.users.auth');

        // If `redirectId` specified - use `redirect_url` form response
        if (redirectId) {
          window.location = res.redirect_url;
          return;
        }

        // If this page loaded directly - navigate to `redirect_url`
        if (!previousPageParams) {
          window.location = res.redirect_url;
          return;
        }

        // Check that previous page can be loaded, because it can return redirect or forbid access
        N.io.rpc(previousPageParams.apiPath, previousPageParams.params, { handleAllErrors: true })
          .done(function () {
            // Navigate to previous page
            window.location = N.router.linkTo(previousPageParams.apiPath, previousPageParams.params);
          })
          .fail(function () {
            window.location = res.redirect_url;
          });
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
