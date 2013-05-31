// Show login form.


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});


  N.wire.on(apiPath, function login_show(env, callback) {
    env.response.data.head.title = env.t('title');

    N.models.users.LoginLimitTotal.check(function (err, isExceeded) {
      if (err) {
        callback(err);
        return;
      }

      env.response.data.captcha_required = isExceeded;
      callback();
    });
  });
};
