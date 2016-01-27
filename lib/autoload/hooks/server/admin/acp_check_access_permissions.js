// Check if user has permittions to access admin control panel.
//


'use strict';


module.exports = function (N) {

  // Redirect guests to login page
  //
  N.wire.before('server:admin*', { priority: -110 }, function acp_login_redirect(env, callback) {
    N.wire.emit('internal:users.force_login_guest', env, callback);
  });


  // Check permissions
  //
  N.wire.before('server:admin*', { priority: -100 }, function* acp_check_permissions(env) {
    let can_access_acp = yield env.extras.settings.fetch('can_access_acp');

    // In other cases - 401 (Not authorised)
    if (!can_access_acp) throw N.io.FORBIDDEN;
  });
};
