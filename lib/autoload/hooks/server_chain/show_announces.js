// Show announces to users


'use strict';


module.exports = function (N) {

  N.wire.before('server_chain:*', function* show_announces(env) {
    if (!N.config.announces) return;

    for (let announceid of Object.keys(N.config.announces)) {
      let announce = N.config.announces[announceid];

      if (!announce.usergroup) continue;

      let usergroup;

      try {
        usergroup = yield N.models.users.UserGroup.findIdByName(announce.usergroup);
      } catch (__) {
        // suppress "usergroup not found" errors
      }

      if (usergroup && env.user_info.usergroups.some(ug => String(ug) === String(usergroup))) {
        env.res.announces = env.res.announces || [];
        env.res.announces.push({
          id:          announceid,
          can_dismiss: !!announce.dismiss_days
        });
      }
    }
  });
};
