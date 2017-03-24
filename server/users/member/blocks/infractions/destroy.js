// Delete infraction
//
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    infraction_id: { format: 'mongo', required: true },
    reason:        { type: 'string' }
  });


  // Check auth and permissions
  //
  N.wire.before(apiPath, function* check_permissions(env) {
    if (!env.user_info.is_member) throw N.io.FORBIDDEN;

    let infraction = yield N.models.users.Infraction.findOne()
                              .where('_id').equals(env.params.infraction_id)
                              .where('exists').equals(true)
                              .lean(true);

    if (!infraction) throw N.io.BAD_REQUEST;

    // Allow delete own infractions
    if (String(infraction.from) === String(env.user_info.user_id)) return;

    // Check delete permission
    let can_delete_infractions = yield env.extras.settings.fetch('can_delete_infractions');

    if (!can_delete_infractions) throw N.io.FORBIDDEN;
  });


  // Delete infraction
  //
  N.wire.on(apiPath, function* delete_infraction(env) {
    let update = {
      del_by: env.user_info.user_id,
      exists: false
    };

    if (env.params.reason) update.del_reason = env.params.reason;

    yield N.models.users.Infraction.update({
      _id: env.params.infraction_id,
      exists: true
    }, update);
  });
};
