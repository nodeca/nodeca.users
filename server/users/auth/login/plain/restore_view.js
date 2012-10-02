"use strict";

/*global nodeca*/

var params_schema = {};
nodeca.validate(params_schema);


/**
 * users.auth.login.plain/restore_view(params, callback) -> Void
 *
 * Render restore password form
 **/
module.exports = function (params, next) {
  var env = this;
  var head = env.response.data.head;
  
  head.title = env.helpers.t('users.auth.restore_form.title');

  next();
};
