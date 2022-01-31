// Do logout


'use strict';

const archive_session = require('nodeca.users/lib/archive_session');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, async function logout(env) {
    await archive_session(N, env.session_id, N.models.users.AuthSessionLog.logout_types.LOGOUT);

    // force all other tabs to reload
    env.extras.setCookie('reload_tabs', 1, { httpOnly: false });
  });
};
