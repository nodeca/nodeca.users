// Inject APC access permission into response
// Required in layout, for http requests only
//


'use strict';


var _ = require('lodash');


module.exports = function (N) {

  // Redirect to login page, if no permittions
  //
  N.wire.after('server_chain:http:*', function (env, callback) {

    env.extras.puncher.start('Fetch ACP access settings');

    env.extras.settings.fetch(['can_access_acp'], function (err, settings) {
      env.extras.puncher.stop();

      if (err) {
        callback(err);
        return;
      }

      env.response.data.settings = _.extend({}, env.response.data.settings, settings);

      callback();
    });
  });
};