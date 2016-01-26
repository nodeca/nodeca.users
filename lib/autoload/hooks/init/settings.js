// Attach settings object to env
//

'use strict';


const thenify = require('thenify');


module.exports = function (N) {
  require('nodeca.core/lib/system/env').initHandlers.push(function (env) {
    var params = {};

    env.extras.settings = {
      params,

      fetch: thenify.withCallback(function fetchSettings(keys, callback) {
        params.user_id       = env.user_info.user_id || '000000000000000000000000';
        params.usergroup_ids = env.user_info.usergroups;

        N.settings.get(keys, params, {}, callback);
      })
    };
  });
};
