// Reload other tabs on login and logout
//

'use strict';


N.wire.once('navigate.done', function page_setup() {

  // Reload page on `local.users.auth` message after delay
  //
  N.broadcast.on('local.users.auth', function logout_reload() {
    // Automatically reload after 2 sec
    setTimeout(function () {
      window.location.reload();
    }, 2000);
  });
});
