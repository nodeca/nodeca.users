// Check if user has permittions to access admin control panel.
//


'use strict';


module.exports = function (N) {

  // Redirect to login page, if no permittions
  //
  N.wire.before('server:admin*', { priority: -100 }, function acp_check_permissions(env, callback) {

    env.extras.settings.fetch('can_access_acp', function (err, can_access_acp) {
      if (err) {
        callback(err);
        return;
      }

      if (!can_access_acp) {

        // for guests - redirect to login
        if (env.user_info.is_guest) {
          callback({
            code: N.io.REDIRECT,
            head: {
              Location: N.router.linkTo('users.auth.login.show')
            }
          });
          return;
        }

        // In other cases - 401 (Not authorised)
        callback(N.io.FORBIDDEN);
        return;
      }

      callback();
    });
  });
};
