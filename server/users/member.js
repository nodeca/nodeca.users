"use strict";

/*global nodeca*/


// Validate input parameters
//
var params_schema = {
  id: {
    type: "integer",
    minimum: 1,
    required: true
  }
};

nodeca.validate(params_schema);


module.exports = function (params, next) {
  next();
};
