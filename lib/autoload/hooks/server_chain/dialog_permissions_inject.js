// Check whether user is allowed to use dialogs or not,
// used to render "dialogs" option in navbar menu.
//


'use strict';


module.exports = function (N) {

  N.wire.after('server_chain:http:*', function* inject_dialog_permissions(env) {
    let can_use_dialogs = yield env.extras.settings.fetch('can_use_dialogs');

    env.runtime.settings = env.runtime.settings || {};
    env.runtime.settings.can_use_dialogs = can_use_dialogs;
  });
};
