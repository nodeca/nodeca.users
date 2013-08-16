// Show 'Enter new password' form or show error on invalid reset password token.


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    secret_key: { type: 'string', required: true }
  });

  N.wire.on(apiPath, function (env, callback) {
    env.res.head.title = env.t('title');
    env.res.secret_key = env.params.secret_key;

    N.models.users.TokenResetPassword.findOne({
      secret_key: env.params.secret_key
    }, function (err, token) {
      if (err) {
        callback(err);
        return;
      }

      env.res.valid_token = token && !token.isExpired();
      callback();
    });
  });
};
