// Show form with email and captcha to request password reset.


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function (env) {
    env.response.data.head.title = env.t('title');
  });
};
