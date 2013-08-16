// Show 'Password reset confirmation email is sent' message.


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function (env) {
    env.res.head.title = env.t('title');
  });
};
