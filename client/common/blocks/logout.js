'use strict';

N.wire.on(module.apiPath, function logout_init() {
  N.io.rpc('users.auth.logout').then(function () {
    // Notify other browser tabs about logout
    N.live.emit('local.users.auth');

    // In order to perform logout, we must reload page. Go to site root.
    window.location = '/';
  });
});
