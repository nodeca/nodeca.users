// Show page with 'Password is changed' message.


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function change_done_show(env) {
    env.res.head.title = env.t('title');
  });
};
