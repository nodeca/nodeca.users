"use strict";

/*global nodeca*/


var params_schema = {
};
nodeca.validate(params_schema);


/**
 * users.auth.register.show(params, callback) -> Void
 *
 * Render registration form
 **/
module.exports = function (params, next) {
  var env = this;
  var data = env.response.data;
  
  data.head.title = env.helpers.t('users.auth.reg_form.title');
  next();
};
