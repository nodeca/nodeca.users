"use strict";

/*global nodeca*/

var rate = require('./_rate_limit.js');


var params_schema = {
};
nodeca.validate(params_schema);


// Inject flag to show captcha field, if needed (when too many failed attempt)
// See server.login.plain.exec() for details
//
nodeca.filters.before('@', function login_inject_captcha(params, next) {
  var env = this,
      user_ip = env.request.ip;
 
  rate.ip.count(user_ip, function (err, high) {
    if (err) {
      next(err);
      return;
    }

    env.response.data.captcha_required = high;
    next();
  });
});


/**
 * users.auth.login.show(params, callback) -> Void
 *
 * Render registration form
 **/
module.exports = function (params, next) {
  var env = this;
  var head = env.response.data.head;
  
  head.title = env.helpers.t('users.auth.login_form.title');

  next();
};
