// Page with a message that email is changed

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function activate_done(env) {
    env.res.head.title = env.t('title');
  });
};
