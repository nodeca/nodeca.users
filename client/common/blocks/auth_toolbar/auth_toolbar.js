'use strict';


N.wire.on('common.blocks.auth_toolbar.logout', function () {
  N.io.rpc('users.auth.logout', function (err) {
    if (err) {
      return false;
    }

    // In order to perform logout, we must reload the page.
    window.location.reload();
  });
});
