// Update subscription
//
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    subscription_id: { format: 'mongo', required: true },
    type:            { type: 'integer', required: true }
  });


  // Check type
  //
  N.wire.before(apiPath, function check_type(env) {
    if (Object.values(N.models.users.Subscription.types).indexOf(env.params.type) === -1) {
      return N.io.BAD_REQUEST;
    }
  });


  // Check auth
  //
  N.wire.before(apiPath, function check_auth(env) {
    if (!env.user_info.is_member) throw N.io.FORBIDDEN;
  });


  // Update subscription
  //
  N.wire.on(apiPath, async function update_subscription(env) {
    let res = await N.models.users.Subscription
                        .findOneAndUpdate({ type: env.params.type })
                        .where('_id').equals(env.params.subscription_id)
                        .where('user').equals(env.user_info.user_id)
                        .lean(true);

    if (!res) throw N.io.NOT_FOUND;
  });
};
