// Show page with message that login link was sent.


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function login_by_email_show(env) {
    env.res.head.title = env.t('title');
  });
};
