// Reload page on `local.users.auth` message after delay
//
'use strict';


N.wire.once('navigate.done', function login_logout_reload_init() {
  N.live.on('local.users.auth', function logout_reload() {
    // Automatically reload after 2 sec
    setTimeout(function () {
      window.location.reload();
    }, 2000);
  });
});
