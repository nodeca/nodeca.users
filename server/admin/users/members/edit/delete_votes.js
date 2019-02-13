// Delete votes created by a user
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


  // Delete votes
  //
  N.wire.on(apiPath, async function delete_votes(env) {
    await N.models.users.Vote.deleteMany({ from: env.data.user._id });
  });
};
