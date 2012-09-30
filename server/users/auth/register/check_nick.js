"use strict";

/*global nodeca, _*/

var User = nodeca.models.users.User;

// Validate input parameters
//
var params_schema = {
  nick: {
    type: "string",
    minLength: 1,
    required: true
  }
};
nodeca.validate(params_schema);

/**
 * users.auth.register.check_nick(params, callback) -> Void
 *
 * ##### Params
 * - nick(String):        Nickname
 *
 * Register new user
 *
 **/
module.exports = function (params, next) {
  var env = this;
  User.findOne({ 'nick': params.nick}).setOptions({ lean: true })
      .exec(function(err, doc){
    if (err) {
      next(err);
      return;
    }
    if (!_.isEmpty(doc)) {
      next({
        statusCode: 409,
        body: { nick: env.helpers.t('users.auth.reg_form.error.nick_busy')}
      });
      return;
    }
    next();

  });
};
