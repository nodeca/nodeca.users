// Attach settings object to env
//

'use strict';


module.exports = function (N) {
  require('nodeca.core/lib/system/env').initHandlers.push(function (env) {
    var params = {};

    env.extras.settings = {
      params: params,

      fetch: function fetchSettings(keys, callback) {
        params.user_id       = env.user_info.user_id || '000000000000000000000000';
        params.usergroup_ids = env.user_info.usergroups;

        N.settings.get(keys, params, {}, callback);
      }
    };
  });
};
