"use strict";

/*global nodeca*/

var params_schema = {
};
nodeca.validate(params_schema);


/**
 * users.auth.register.success(params, callback) -> Void
 *
 * Show success registration page
 **/
module.exports = function (params, next) {
  var env = this;
  var data = env.response.data;

  data.head.title = env.helpers.t('users.auth.reg_form.title');
  next();
};
