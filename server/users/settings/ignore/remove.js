// Remove a user from ignore list
//
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user: { format: 'mongo', required: true }
  });


  // Check auth
  //
  N.wire.before(apiPath, function check_auth(env) {
    if (!env.user_info.is_member) {
      return N.io.FORBIDDEN;
    }
  });


  // Update ignore list
  //
  N.wire.on(apiPath, function* update_ignore_list(env) {
    yield N.models.users.Ignore.remove({
      from: env.user_info.user_id,
      to:   env.params.user
    });
  });
};
