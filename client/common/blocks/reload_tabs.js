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


// If reload_tabs cookie is set, remove it and reload all other tabs
//
N.wire.on('navigate.done', function reload_other_tabs() {
  if (String(document.cookie).indexOf('reload_tabs=1') !== -1) {
    document.cookie = 'reload_tabs=0; path=/; expires=' + new Date(0).toGMTString();

    // check that cookie was successfully reset, just in case
    if (String(document.cookie).indexOf('reload_tabs=1') === -1) {
      N.broadcast.send('local.users.auth');
    }
  }
});
