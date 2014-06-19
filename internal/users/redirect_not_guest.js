// Redirect logged in users to main page.
// Used to prevent access to login/register and so on.
//
'use strict';


module.exports = function (N, apiPath) {

  N.wire.on(apiPath, function (env) {

    if (!env.user_info.is_guest) {
      throw {
        code: N.io.REDIRECT,
        head: {
          'Location': '/'
        }
      };
    }

    return;
  });
};
