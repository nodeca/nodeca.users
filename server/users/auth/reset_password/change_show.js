// Show 'Enter new password' page or error on invalid token.


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    secret_key: { type: 'string', required: true }
  });


  // Check token and show form
  //
  N.wire.on(apiPath, function change_show(env, callback) {
    env.res.head.title = env.t('title');
    env.res.secret_key = env.params.secret_key;

    N.models.users.TokenResetPassword.findOne({
      secret_key: env.params.secret_key,
      ip:         env.req.ip
    }, function (err, token) {
      if (err) {
        callback(err);
        return;
      }

      //
      // Don't delete token here, we need it for exec action
      //

      env.res.valid_token = token && !token.isExpired();
      callback();
    });
  });
};
