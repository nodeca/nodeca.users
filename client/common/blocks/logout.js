'use strict';

N.wire.on(module.apiPath, function logout_init() {
  N.io.rpc('users.auth.logout').done(function () {

    // In order to perform logout, we must reload the page.
    window.location.reload();
  });
});
