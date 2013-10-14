// Check if user has permittions to access admin control panel.
//


'use strict';


module.exports = function (N) {

  // Redirect to login page, if no permittions
  //
  N.wire.before('server:admin*', { proiroty: -100 }, function(env, callback) {

    env.extras.settings.fetch(['can_access_acp'], function (err, settings) {
      if (err) {
        callback(err);
        return;
      }

      if (!settings.can_access_acp) {

        // for guests - redirect to login
        if (env.user_info.is_guest) {
          callback({
            code: N.io.REDIRECT,
            head: {
              "Location": N.runtime.router.linkTo('users.auth.login.show')
            }
          });
          return;
        }

        // In other cases - 401 (Not authorised)
        callback(N.io.NOT_AUTHORIZED);
        return;
      }

      callback();
    });
  });
};