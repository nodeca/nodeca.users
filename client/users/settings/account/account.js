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
});
