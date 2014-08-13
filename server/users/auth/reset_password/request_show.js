// Show page with email input and captcha to request password change.


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  //
  // Don't limit logged-in users to change pass. Because
  // user can forget password, but still have cookies to remember him.
  //

  N.wire.on(apiPath, function request_show(env) {
    env.res.head.title = env.t('title');
  });
};
