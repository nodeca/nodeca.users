// Page with a message that user is unsubscribed successfully
//
'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function unsubscribe_done(env) {
    env.res.head.title = env.t('title');
  });
};
