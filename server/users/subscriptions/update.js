// Update subscription
//
'use strict';


var _ = require('lodash');


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    subscription_id: { format: 'mongo', required: true },
    type:            { type: 'integer', required: true }
  });


  // Check type
  //
  N.wire.before(apiPath, function check_type(env) {
    if (_.values(N.models.users.Subscription.types).indexOf(env.params.type) === -1) {
      return N.io.BAD_REQUEST;
    }
  });


  // Check auth
  //
  N.wire.before(apiPath, function check_auth(env) {
    if (env.user_info.is_guest) {
      return N.io.FORBIDDEN;
    }
  });


  // Update subscription
  //
  N.wire.on(apiPath, function update_subscription(env, callback) {
    N.models.users.Subscription.findOneAndUpdate({ type: env.params.type })
        .where('_id').equals(env.params.subscription_id)
        .where('user_id').equals(env.user_info.user_id)
        .lean(true)
        .exec(function (err, res) {

      if (err) {
        callback(err);
        return;
      }

      if (!res) {
        callback(N.io.NOT_FOUND);
        return;
      }

      callback();
    });
  });
};
