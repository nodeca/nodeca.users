'use strict';


var _           = require('lodash');
var ko          = require('knockout');
var getFormData = require('nodeca.core/lib/client/get_form_data');


// Knockout view model of the page.
var view = null;


N.wire.on('navigate.done:' + module.apiPath, function setup_page(__, callback) {
  var captchaRequired = N.runtime.page_data.captcha_required;

  view = {
    message: ko.observable(null)
  , recaptcha_response_field: {
      visible: ko.observable(captchaRequired)
    , css:     null
    }
  };

  ko.applyBindings(view, $('#content')[0]);

  if (captchaRequired) {
    N.wire.emit('common.blocks.recaptcha.create', null, callback);
  } else {
    callback();
  }
});


N.wire.on('navigate.exit:' + module.apiPath, function teardown_page() {
  ko.cleanNode($('#content')[0]);
  view = null;
});


N.wire.on('users.auth.login.plain_exec', function login(event) {
  var $form = $(event.currentTarget);

  N.io.rpc('users.auth.login.plain_exec', getFormData($form), function (err) {
    if (err && N.io.CLIENT_ERROR) {
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

      // Reset problem fields.
      _.forEach(err.fields, function (name) {
        $form.find('input[name="' + name + '"]').val('');
      });

      return;
    }

    if (err) {
      return false;
    }

    window.location = N.runtime.router.linkTo('users.profile');
  });
});
