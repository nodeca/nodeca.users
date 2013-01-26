// Render registration form
//
"use strict";


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
  });

  // Request handler
  //
  N.wire.on(apiPath, function (env, callback) {
    env.response.data.head.title = env.helpers.t('users.auth.reg_form.title');
    callback();
  });
};
