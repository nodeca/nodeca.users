// Render registration form
//
'use strict';


var rate = require('./_rate_limit.js');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
  });


  // Inject flag to show captcha field, if needed (when too many failed attempt)
  // See server.login.plain.exec() for details
  //
  N.wire.before(apiPath, function login_inject_captcha(env, callback) {
    var user_ip = env.request.ip;

    rate.ip.count(user_ip, function (err, high) {
      if (err) {
        callback(err);
        return;
      }

      env.response.data.captcha_required = high;
      callback();
    });
  });


  // Request handler
  //
  N.wire.on(apiPath, function (env, callback) {

    env.response.data.head.title = env.helpers.t('users.auth.login.show.title');

    callback();
  });
};
