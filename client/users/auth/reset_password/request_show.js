'use strict';


var ko          = require('knockout');


var view = null;


N.wire.on('navigate.done:' + module.apiPath, function setup_page(__, callback) {
  view = {
    message: ko.observable(null)

  , recaptcha_response_field: {
      visible: true
    , css:     ''
    , message: null
    }
  };

  ko.applyBindings(view, $('#content')[0]);

  N.wire.emit('common.blocks.recaptcha.create', null, callback);
});


N.wire.on('navigate.exit:' + module.apiPath, function teardown_page() {
  ko.cleanNode($('#content')[0]);
  view = null;
});


N.wire.on('users.auth.reset_password.request_exec', function reset_password(form) {

  N.io.rpc('users.auth.reset_password.request_exec', form.fields)
    .done(function () {
      N.wire.emit('common.blocks.recaptcha.update');
      N.wire.emit('navigate.to', { apiPath: 'users.auth.reset_password.request_done_show' });
    })
    .fail(function (err) {
      N.wire.emit('common.blocks.recaptcha.update');
      view.message(err.message);
    });
});
