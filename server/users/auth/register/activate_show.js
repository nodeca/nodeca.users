// Page with message that acount should be activated by email

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function activate_show(env) {
    env.res.head.title = env.t('title');
  });
};
