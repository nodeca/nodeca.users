"use strict";

/*global nodeca*/

var params_schema = {
};
nodeca.validate(params_schema);


/**
 * users.auth.login.plain.restore_exec(params, callback) -> Void
 *
 * Restore user password
 **/
module.exports = function (params, next) {
  next();
};
