// Fill infractions block info
//
'use strict';


const _ = require('lodash');


module.exports = function (N) {

  // Fill infractions
  //
  N.wire.after('server:users.member', function* fill_infractions(env) {
    let can_see_infractions = yield env.extras.settings.fetch('can_see_infractions');

    // Allow if permitted and if owner
    if (!can_see_infractions && String(env.data.user._id) !== env.user_info.user_id) return;

    let query = N.models.users.Infraction.find()
                    .where('for').equals(env.data.user._id)
                    .sort({ ts: -1 })
                    .lean(true);

    // Don't show deleted infractions to user
    if (!can_see_infractions) {
      query.where('exists').equals(true);
    }

    let infractions = yield query;


    // Hide infractions older than half year for owner
    //
    if (!can_see_infractions) {
      let hide = Date.now() - 6 * 30 * 24 * 60 * 60 * 1000;

      infractions = infractions.filter(infraction => {
        if (!infraction.expire) return true;
        return infraction.expire > hide;
      });
    }


    // Subcall to fill urls and titles of content (forum posts, blog entries, etc.)
    //
    // In:
    //
    // - infractions
    // - user_info
    //
    // Out:
    //
    // - info (Object) - key is `src`, value { url, title }
    //
    let info_env = { infractions, user_info: env.user_info, info: {} };

    yield N.wire.emit('internal:users.infraction.info', info_env);


    // Fetch moderators info
    //
    env.data.users = env.data.users || [];
    infractions.forEach(i => {
      env.data.users.push(i.from);
      if (i.del_by) env.data.users.push(i.del_by);
    });


    // Fetch settings
    //
    let users_mod_can_add_infractions = yield env.extras.settings.fetch('users_mod_can_add_infractions');
    let can_delete_infractions = yield env.extras.settings.fetch('can_delete_infractions');
    let can_receive_infractions = yield N.settings.get('can_receive_infractions', {
      user_id: env.data.user._id,
      usergroup_ids: env.data.user.usergroups
    }, {});


    if (infractions.length || (users_mod_can_add_infractions && can_receive_infractions)) {
      _.set(env.res, 'blocks.infractions', {
        list: infractions,
        settings: {
          users_mod_can_add_infractions,
          can_receive_infractions,
          can_delete_infractions
        },
        content_info: info_env.info
      });
    }
  });
};
