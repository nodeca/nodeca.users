// Mark everything as read
//
'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    ts: { type: 'number', required: true }
  });


  N.wire.on(apiPath, async function mark_read(env) {
    let now = Date.now();

    for (let type of N.shared.marker_types || []) {
      // we need to make sure that user specified cut position is higher than existing one;
      // in order to do that we get a cut of a non-existent category (it will be equal to type cut)
      let dummy_category = '000000000000000000000000';
      let cuts = await N.models.users.Marker.cuts(env.user_info.user_id, [ dummy_category ], type);

      if (now > env.params.ts && env.params.ts > cuts[dummy_category]) {
        await N.models.users.Marker.markByType(env.user_info.user_id, type, env.params.ts);
      }
    }
  });
};
