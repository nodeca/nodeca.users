// Show infraction reply
//

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    infraction_id: { format: 'mongo', required: true }
  });


  // Check permission to start dialogs
  //
  N.wire.before(apiPath, async function check_permissions(env) {
    let can_create_dialogs = await env.extras.settings.fetch('can_create_dialogs');

    if (!can_create_dialogs) throw N.io.FORBIDDEN;
  });


  // Fetch infraction and check permissions
  //
  N.wire.before(apiPath, async function fetch_infraction(env) {
    let infraction = await N.models.users.Infraction.findOne()
                              .where('_id').equals(env.params.infraction_id)
                              .where('exists').equals(true)
                              .lean(true);

    if (!infraction) throw N.io.NOT_FOUND;

    // Allow to ask questions only about infractions issued to current user
    // by someone else
    //
    if (String(infraction.from) === String(env.user_info.user_id)) throw N.io.NOT_FOUND;
    if (String(infraction.for) !== String(env.user_info.user_id)) throw N.io.NOT_FOUND;

    // Allow to ask questions only about infractions issued to user within
    // a time limit of half a year
    //
    let hide = Date.now() - 6 * 30 * 24 * 60 * 60 * 1000;

    if (infraction.expire && infraction.expire <= hide) throw N.io.NOT_FOUND;

    env.data.infraction = infraction;
  });


  // Fill page meta
  //
  N.wire.on(apiPath, function fill_page_head(env) {
    env.res.head.title = env.t('title');

    env.res.infraction = env.data.infraction;
  });
};
