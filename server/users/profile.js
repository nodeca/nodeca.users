"use strict";

/*global nodeca*/


// Validate input parameters
//
var params_schema = {
};
nodeca.validate(params_schema);


module.exports = function (params, next) {
  next();
};
