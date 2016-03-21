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
    if (env.user_info.is_guest) throw N.io.FORBIDDEN;

    let users_mod_can_add_infractions = yield env.extras.settings.fetch('users_mod_can_add_infractions');

    if (!users_mod_can_add_infractions) throw N.io.FORBIDDEN;
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
