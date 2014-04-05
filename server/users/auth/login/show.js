// Show login form.


'use strict';


module.exports = function (N, apiPath) {
  var rateLimit = require('./_rate_limit')(N);


  N.validate(apiPath, {});


  N.wire.before(apiPath, function login_guest_only(env, callback) {
    N.wire.emit('internal:users.redirect_not_guest', env, callback);
  });


  N.wire.on(apiPath, function login_show(env, callback) {
    env.res.head.title = env.t('title');

    rateLimit.total.check(function (err, isExceeded) {
      if (err) {
        callback(err);
        return;
      }

      env.res.captcha_required = isExceeded;
      callback();
    });
  });
};
