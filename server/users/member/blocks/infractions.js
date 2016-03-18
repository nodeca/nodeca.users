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

    let infractions = yield N.models.users.Infraction.find()
                                .where('for').equals(env.data.user._id)
                                .where('exists').equals(true)
                                .sort({ ts: -1 })
                                .lean(true);

    // Hide infractions older than half year for owner
    if (!can_see_infractions) {
      let hide = Date.now() - 6 * 30 * 24 * 60 * 60 * 1000;

      infractions = infractions.filter(infraction => {
        if (!infraction.expire) return true;
        return infraction.expire > hide;
      });
    }

    let data = {
      list: infractions,
      urls: {}
    };

    // Subcall to fill urls to content (forum posts, blog entries, etc.)
    yield N.wire.emit('internal:users.infractions.fill_content_urls', data);


    // Fetch moderators info
    //
    env.data.users = env.data.users || [];
    infractions.forEach(i => env.data.users.push(i.from));


    if (infractions.length) {
      _.set(env.res, 'blocks.infractions', data);
    }
  });
};
