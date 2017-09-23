// Inject APC access permission into response
// Required in layout, for http requests only
//


'use strict';


module.exports = function (N) {

  // Redirect to login page, if no permittions
  //
  N.wire.after('server_chain:http:*', async function inject_acp_access_state(env) {
    let can_access_acp = await env.extras.settings.fetch('can_access_acp');

    env.runtime.settings = env.runtime.settings || {};
    env.runtime.settings.can_access_acp = can_access_acp;
  });
};
