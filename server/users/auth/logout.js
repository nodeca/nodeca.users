// Do logout


'use strict';

const archive_session = require('nodeca.users/lib/archive_session');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function* logout(env) {
    if (!env.session_id) return;

    yield archive_session(N, env.session_id, N.models.users.AuthSessionLog.logout_types.LOGOUT);

    // If there are no errors, we can finally set session to null,
    // so core could reset user cookie
    //
    env.session = null;

    // force all other tabs to reload
    env.extras.setCookie('reload_tabs', 1, { httpOnly: false });
  });
};
