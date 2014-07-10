// Inject APC access permission into response
// Required in layout, for http requests only
//


'use strict';


module.exports = function (N) {

  // Redirect to login page, if no permittions
  //
  N.wire.after('server_chain:http:*', function inject_acp_access_state(env, callback) {

    env.extras.puncher.start('fetch settings (can_access_acp)');

    env.extras.settings.fetch('can_access_acp', function (err, can_access_acp) {
      env.extras.puncher.stop();

      if (err) {
        callback(err);
        return;
      }

      env.res.settings = env.res.settings || {};
      env.res.settings.can_access_acp = can_access_acp;

      callback();
    });
  });
};
