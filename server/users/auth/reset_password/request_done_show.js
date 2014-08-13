// Show page with message that password change token was sent.


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function request_done_show(env) {
    env.res.head.title = env.t('title');
  });
};
