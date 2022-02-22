'use strict';

N.wire.on(module.apiPath, function logout_init() {
  N.io.rpc('users.auth.logout').then(function () {
    // reload all other tabs on logout
    N.broadcast.send('local.users.auth');

    // In order to perform logout, we must reload page. Go to site root.
    window.location = '/';
  });
});
