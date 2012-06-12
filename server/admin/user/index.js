"use strict";

/*global nodeca*/

module.exports = function (params, next) {
  console.dir(nodeca.config.menus);
  next();
};
