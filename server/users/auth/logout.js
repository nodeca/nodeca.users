"use strict";

/*global nodeca, _*/


var params_schema = {};
nodeca.validate(params_schema);


/**
 * login.email(params, next) -> Void
 *
 * ##### params
 *
 * - `email`      user email or nick
 * - `pass`       user password
 *
 * login by email provider
 **/
module.exports = function (params, next) {
  this.session = null;
  next({
    statusCode: 302,
    headers: { Location: nodeca.runtime.router.linkTo('forum.index') }
  });
};
