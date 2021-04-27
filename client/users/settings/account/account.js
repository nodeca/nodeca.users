'use strict';


// Setup listeners
//
N.wire.once('navigate.done:' + module.apiPath, function page_once() {

  // Change password
  //
  N.wire.on('users.settings.account:change_password', function request_reset() {

    return N.io.rpc('users.settings.account.change_password.request_exec')
      .then(() => N.wire.emit('navigate.to', { apiPath: 'users.auth.reset_password.request_done_show' }));
  });


  // Close session
  //
  N.wire.on('users.settings.account:close_session', function close_session(data) {
    return Promise.resolve()
      .then(() => N.io.rpc('users.settings.account.close_session', { id: data.$this.data('authsession-id') }))
      .then(() => N.wire.emit('notify.info', t('session_closed')))
      .then(() => N.wire.emit('navigate.reload'));
  });
});
