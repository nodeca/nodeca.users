"use strict";

/*global nodeca, _*/

var params_schema = {};
nodeca.validate(params_schema);


/**
 * users.auth.login.view(params, callback) -> Void
 *
 * Render registration form
 **/
module.exports = function (params, next) {
  var env = this;
  var head = env.response.data.head;
  
  head.title = env.helpers.t('users.auth.login_form.title');

  next();
};
