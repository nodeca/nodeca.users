// Unsubscribe from dialogs notifications
//
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {});


  // Check permissions
  //
  N.wire.before(apiPath, function check_permissions(env) {
    if (env.user_info.is_guest) return N.io.FORBIDDEN;
  });


  // Update subscription status
  //
  N.wire.on(apiPath, function* update_subscription_status(env) {
    yield N.settings.getStore('user').set(
      { dialogs_notify: { value: false } },
      { user_id: env.user_info.user_id }
    );
  });
};
