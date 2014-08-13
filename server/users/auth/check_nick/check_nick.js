// Check if nick is not occupied.


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    nick: { type: 'string', required: true, minLength: 1 }
  });

  N.wire.on(apiPath, function check_nick_busy(env, callback) {
    env.res.error   = false;
    env.res.message = null;

    if (!N.models.users.User.validateNick(env.params.nick)) {
      env.res.error = true;
      callback();
      return;
    }

    N.models.users.User
        .findOne({ nick: env.params.nick })
        .select('_id')
        .lean(true)
        .exec(function (err, user) {

      if (err) {
        callback(err);
        return;
      }

      if (user) {
        env.res.error   = true;
        env.res.message = env.t('message_busy_nick');
      }

      callback();
    });
  });
};
