// Inject settings used by generic client scripts
//

'use strict';


module.exports = function (N) {

  N.wire.after('server_chain:http:*', async function inject_acp_access_state(env) {
    env.runtime.settings = env.runtime.settings || {};

    let settings = await env.extras.settings.fetch([
      // APC access permission, required in layout
      'can_access_acp',

      // Access to dialogs, used to render "dialogs" option in navbar menu
      'can_use_dialogs',

      // Setting to disable images/videos
      'hide_heavy_content'
    ]);

    Object.assign(env.runtime.settings, settings);
  });
};
