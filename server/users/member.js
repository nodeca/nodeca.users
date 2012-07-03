"use strict";

/*global nodeca*/

module.exports = function (params, next) {
  console.dir(params['id']);
  next();
};
