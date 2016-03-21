// Fill infractions block info
//
'use strict';


const _ = require('lodash');
const userInfo = require('nodeca.users/lib/user_info');


module.exports = function (N) {

  // Fill infractions
  //
  N.wire.after('server:users.member', function* fill_infractions(env) {
    let can_see_infractions = yield env.extras.settings.fetch('can_see_infractions');

    // Allow if permitted and if owner
    if (!can_see_infractions && String(env.data.user._id) !== env.user_info.user_id) return;

    let infractions = yield N.models.users.Infraction.find()
                                .where('for').equals(env.data.user._id)
                                .where('exists').equals(true)
                                .sort({ ts: -1 })
                                .lean(true);


    // Hide infractions older than half year for owner
    //
    if (!can_see_infractions) {
      let hide = Date.now() - 6 * 30 * 24 * 60 * 60 * 1000;

      infractions = infractions.filter(infraction => {
        if (!infraction.expire) return true;
        return infraction.expire > hide;
      });
    }


    // Subcall to fill urls to content (forum posts, blog entries, etc.)
    //
    let user_info = yield userInfo(N, env.data.user._id);
    let params = { items: infractions.map(i => ({ id: i.src_id, type: i.src_type })), user_info };

    yield N.wire.emit('internal:common.fill_content_urls', params);


    // Fetch moderators info
    //
    env.data.users = env.data.users || [];
    infractions.forEach(i => env.data.users.push(i.from));


    // Fetch settings
    //
    let users_mod_can_add_infractions = yield env.extras.settings.fetch('users_mod_can_add_infractions');
    let can_receive_infractions = yield N.settings.get('can_receive_infractions', {
      user_id: env.data.user._id,
      usergroup_ids: env.data.user.usergroups
    }, {});


    if (infractions.length || (users_mod_can_add_infractions && can_receive_infractions)) {
      _.set(env.res, 'blocks.infractions', {
        list: infractions,
        settings: {
          users_mod_can_add_infractions,
          can_receive_infractions
        },
        urls: params.urls || {}
      });
    }
  });
};
