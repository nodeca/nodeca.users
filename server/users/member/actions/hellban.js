// Set/unset hellban status for user
//
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_id: { format: 'mongo', required: true },
    hellban: { type: 'boolean', required: true }
  });


  // Check auth and permissions
  //
  N.wire.before(apiPath, async function check_permissions(env) {
    if (!env.user_info.is_member) throw N.io.FORBIDDEN;

    let can_hellban = await env.extras.settings.fetch('can_hellban');

    if (!can_hellban) throw N.io.FORBIDDEN;
  });


  // Check if user exists
  //
  N.wire.before(apiPath, async function check_user(env) {
    let user = await N.models.users.User.find()
                        .where('_id').equals(env.params.user_id)
                        .lean(true);

    if (!user) throw N.io.NOT_FOUND;
  });


  // Update hellban status
  //
  N.wire.on(apiPath, async function update_hellban_status(env) {
    await N.models.users.User.update({ _id: env.params.user_id }, { hb: env.params.hellban });
  });
};
