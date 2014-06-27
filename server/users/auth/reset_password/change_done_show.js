// Show 'Password is changed' message.


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function fill_page_head(env) {
    env.res.head.title = env.t('title');
  });
};
