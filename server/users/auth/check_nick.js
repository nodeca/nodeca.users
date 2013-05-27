// Check if nick is not occupied.


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    nick: {
      type: 'string'
    , required: true
    , minLength: 1
    }
  });

  N.wire.on(apiPath, function (env, callback) {
    env.response.data.error   = false;
    env.response.data.message = null;

    if (!N.models.users.User.validateNick(env.params.nick)) {
      env.response.data.error = true;
      callback();
      return;
    }

    N.models.users.User
        .findOne({ 'nick': env.params.nick })
        .select('_id')
        .setOptions({ lean: true })
        .exec(function (err, user) {

      if (err) {
        callback(err);
        return;
      }

      if (user) {
        env.response.data.error   = true;
        env.response.data.message = env.helpers.t('users.auth.register.check_nick.message_nick_busy');
      }

      callback();
    });
  });
};
