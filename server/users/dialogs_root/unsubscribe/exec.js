// Unsubscribe from dialogs notifications
//
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {});


  // Check permissions
  //
  N.wire.before(apiPath, function check_permissions(env) {
    if (!env.user_info.is_member) return N.io.FORBIDDEN;
  });


  // Update subscription status
  //
  N.wire.on(apiPath, async function update_subscription_status(env) {
    await N.settings.getStore('user').set(
      { dialogs_notify: { value: false } },
      { user_id: env.user_info.user_id }
    );
  });
};
