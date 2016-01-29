// Remove subscription
//
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    subscription_id: { format: 'mongo', required: true }
  });


  // Check auth
  //
  N.wire.before(apiPath, function check_auth(env) {
    if (env.user_info.is_guest) throw N.io.FORBIDDEN;
  });


  // Remove subscription
  //
  N.wire.on(apiPath, function* remove_subscription(env) {
    yield N.models.users.Subscription.remove()
              .where('_id').equals(env.params.subscription_id)
              .where('user_id').equals(env.user_info.user_id);
  });
};
