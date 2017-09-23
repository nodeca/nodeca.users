// Check if nick is not occupied.


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    nick: { type: 'string', required: true, minLength: 1 }
  });

  N.wire.on(apiPath, async function check_nick_busy(env) {
    env.res.error   = false;
    env.res.message = null;

    if (!N.models.users.User.validateNick(env.params.nick)) {
      env.res.error = true;
      env.res.message = env.t('message_invalid_nick');
      return;
    }

    if (await N.models.users.User.similarExists(env.params.nick)) {
      env.res.error   = true;
      env.res.message = env.t('message_busy_nick');
      return;
    }
  });
};
