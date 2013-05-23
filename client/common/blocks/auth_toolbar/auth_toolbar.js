'use strict';


N.wire.on('users.auth.logout', function () {
  N.io.rpc('users.auth.logout', function (err, response) {
    if (err) {
      return false;
    }

    // In order to perform logout, we must reload the page.
    if (response.data.redirect_url) {
      window.location = response.data.redirect_url;
    } else {
      window.location.reload();
    }
  });
});
