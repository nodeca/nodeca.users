// Show rules page
//

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function rules(env) {
    env.res.head.title = env.t('title');
  });
};
