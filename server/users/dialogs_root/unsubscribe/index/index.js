// Show dialogs unsubscribe page
//
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {});


  // Redirect guests to login page
  //
  N.wire.before(apiPath, async function force_login_guest(env) {
    await N.wire.emit('internal:users.force_login_guest', env);
  });


  // Fill head meta
  //
  N.wire.on(apiPath, function fill_meta(env) {
    env.res.head = env.res.head || {};
    env.res.head.title = env.t('title');
  });
};
