'use strict';


var userInfo = require('nodeca.users/lib/user_info');


module.exports = function (N) {
  N.wire.on('internal.live.subscribe:admin.*', function* live_admin_access(data) {
    let session = yield data.getSession();

    if (!session.user_id) return;

    let info = yield userInfo(N, session.user_id);

    let params = {
      user_id: info.user_id,
      usergroup_ids: info.usergroups
    };

    let can_access_acp = yield N.settings.get('can_access_acp', params, {});

    if (can_access_acp) { data.allowed = true; }
  });
};
