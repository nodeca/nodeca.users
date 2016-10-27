// Unblock user if they are blocked after receiving too many infractions
//

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    user_hid: { type: 'integer', minimum: 1, required: true }
  });


  // Fetch member by 'user_hid'
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env) {
    return N.wire.emit('internal:users.fetch_user_by_hid', env);
  });


  // Unblock user
  //
  N.wire.on(apiPath, function* unblock(env) {
    let penalty = yield N.models.users.UserPenalty.findOne()
                            .where('user').equals(env.data.user._id)
                            .lean(true);

    if (penalty) {
      yield N.wire.emit(`internal:users.infraction.${penalty.type}.remove`, penalty);

      yield N.models.users.UserPenalty.remove({ _id: penalty._id });
    }
  });
};
