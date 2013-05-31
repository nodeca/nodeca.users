'use strict';


var getFormData = require('nodeca.core/lib/client/get_form_data');


N.wire.on('users.auth.reset_password.apply', function reset_password(event) {
  var $form = $(event.currentTarget);

  N.io.rpc('users.auth.reset_password.apply', getFormData($form), function (err) {
    if (err && N.io.CLIENT_ERROR === err.code) {
      $form.find('input').parents('.control-group:first').addClass('error');
      return;
    }

    if (err) {
      return false;
    }

    N.wire.emit('notify', { type: 'info', message: t('password_changed') });
    N.wire.emit('navigate.to', { apiPath: 'users.auth.login.show' });
  });
});
