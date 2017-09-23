'use strict';


module.exports = function (N) {
  N.wire.on('internal.live.subscribe:admin.*', async function live_admin_access(data) {
    let user_info = await data.getUserInfo();

    if (!user_info) return;

    let params = {
      user_id: user_info.user_id,
      usergroup_ids: user_info.usergroups
    };

    let can_access_acp = await N.settings.get('can_access_acp', params, {});

    if (can_access_acp) data.allowed = true;
  });
};
