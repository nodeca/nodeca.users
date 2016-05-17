// Add infraction to user
//
'use strict';


const _        = require('lodash');
const userInfo = require('nodeca.users/lib/user_info');


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_id: { format: 'mongo', required: true },
    type:    { type: 'string', required: true },
    expire:  { type: 'integer', required: true },
    points:  { type: 'integer', required: true },
    reason:  { type: 'string' }
  });


  // Validate type
  //
  N.wire.before(apiPath, function validate_type(env) {
    let types = _.get(N.config, 'users.infractions.types', {});

    if (env.params.type === 'custom') {
      if (!env.params.reason) throw N.io.BAD_REQUEST;
    } else if (!types[env.params.type]) throw N.io.BAD_REQUEST;
  });


  // Check auth and permissions
  //
  N.wire.before(apiPath, function* check_permissions(env) {
    if (env.user_info.is_guest) throw N.io.FORBIDDEN;

    let users_mod_can_add_infractions = yield env.extras.settings.fetch('users_mod_can_add_infractions');

    if (!users_mod_can_add_infractions) throw N.io.FORBIDDEN;

    let user_info = yield userInfo(N, env.params.user_id);
    let params = {
      user_id: user_info.user_id,
      usergroup_ids: user_info.usergroups
    };
    let cannot_receive_infractions = yield N.settings.get('cannot_receive_infractions', params, {});

    // Should never happens - restricted on client
    if (cannot_receive_infractions) throw N.io.BAD_REQUEST;
  });


  // Save infraction
  //
  N.wire.on(apiPath, function* add_infraction(env) {
    let infraction = new N.models.users.Infraction({
      from: env.user_info.user_id,
      'for': env.params.user_id,
      type: env.params.type,
      reason: env.params.reason,
      points: env.params.points
    });

    if (env.params.expire > 0) {
      // Expire in days
      infraction.expire = new Date(Date.now() + (env.params.expire * 24 * 60 * 60 * 1000));
    }

    yield infraction.save();
  });
};
