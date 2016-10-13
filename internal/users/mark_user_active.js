// Mark user as "active", means that user have posted something on
// the website. Used to remove abandoned accounts with no past activity.
//

'use strict';


module.exports = function (N, apiPath) {

  N.wire.on(apiPath, function* mark_user_active(env) {
    if (!env.user_info.active) {
      env.user_info.active = true;

      yield N.models.users.User.update(
        { _id: env.user_info.user_id },
        { $set: { active: true } }
      );
    }
  });
};
