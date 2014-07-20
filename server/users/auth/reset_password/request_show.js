// Show form with email and captcha to request password reset.


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});


  //
  // Don't limit logged-in users to change pass. Because
  // user can forget password, but still have cookies to remember him.
  //

  N.wire.on(apiPath, function fill_page_head(env) {
    env.res.head.title = env.t('title');
  });
};
