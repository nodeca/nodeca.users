'use strict';


var ko          = require('knockout');
var getFormData = require('nodeca.core/lib/client/get_form_data');


var view = null;


N.wire.on('navigate.done:' + module.apiPath, function setup_page(__, callback) {
  view = {
    status:  ko.observable(null)
  , message: ko.observable(null)
  };

  ko.applyBindings(view, $('#content')[0]);

  N.wire.emit('common.blocks.recaptcha.create', null, callback);
});


N.wire.on('navigate.exit:' + module.apiPath, function teardown_page() {
  ko.cleanNode($('#content')[0]);
  view = null;
});


N.wire.on('users.auth.reset_password.request_exec', function reset_password(event) {
  var $form = $(event.currentTarget);

  N.io.rpc('users.auth.reset_password.request_exec', getFormData($form), function (err) {
    N.wire.emit('common.blocks.recaptcha.update');

    if (err && err.message) {
      view.status('text-error');
      view.message(err.message);
      return;
    }

    if (err) {
      return false;
    }

    view.status('text-success');
    view.message(t('email_is_sent'));
  });
});
