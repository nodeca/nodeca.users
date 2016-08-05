// Show announces to users


'use strict';


module.exports = function (N) {

  N.wire.before('server_chain:*', function* show_announces(env) {
    if (!N.config.announces) return;

    let announces = [];

    //
    // Find announces we can show to user's group
    //
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
        announces.push({
          id:        announceid,
          hide_days: announce.hide_days
        });
      }
    }

    //
    // Check that selected announces haven't been dismissed already
    //
    if (announces.length) {
      let hide_dates = ((yield N.models.users.AnnounceHideMark.findOne({
        user: env.user_info.user_id
      })) || {}).hide || {};

      let need_cleanup = false;

      announces = announces.filter(ann => {
        // Only show announce if either:
        //  - it cannot be hidden
        //  - user didn't hide it
        //  - user did hide it, but it reappeared again after some time
        //
        if (!ann.hide_days) return true;

        if (!hide_dates[ann.id]) return true;

        if (+hide_dates[ann.id] > Date.now()) return false;

        delete hide_dates[ann.id];
        need_cleanup = true;
        return true;
      });

      if (need_cleanup) {
        if (Object.keys(hide_dates).length > 0) {
          yield N.models.users.AnnounceHideMark.update(
            { user: env.user_info.user_id },
            { $set: { hide: hide_dates } }
          );
        } else {
          yield N.models.users.AnnounceHideMark.remove(
            { user: env.user_info.user_id }
          );
        }
      }
    }

    if (announces.length) {
      env.res.announces = (env.res.announces || []).concat(announces);
    }
  });
};
