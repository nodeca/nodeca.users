// Registration error page, when used tryed to use oauth provider with
// email, that already used in another account.

'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {});


  // Fill head meta
  //
  N.wire.on(apiPath, function error_show(env) {
    env.res.head.title = env.t('title');
  });
};
