"use strict";

/*global nodeca, _*/


var params_schema = {};
nodeca.validate(params_schema);


/**
 * users.auth.register.view(params, callback) -> Void
 *
 * Render registration form
 **/
module.exports = function (params, next) {
  var env = this;
  var data = env.response.data;
  
  data.head.title = env.helpers.t('users.auth.reg_form.title');
  next();
};
