"use strict";

/*global nodeca, _*/

var AuthLink = nodeca.models.users.AuthLink;
var User = nodeca.models.users.User;

// Validate input parameters
//
var params_schema = {
  email: {
    type: "string",
    required: true
  },
  pass: {
    type: "string",
    minLenght: 8,
    required: true
  }
};
nodeca.validate(params_schema);


/**
 * users.auth.login.email(params, next) -> Void
 *
 * ##### params
 *
 * - `email`      user email or nick
 * - `pass`       user password
 *
 * login by email provider
 **/
module.exports = function (params, next) {
  var env = this;

  // try find user by email or nick
  AuthLink.findOne().or([{'email': params.email}, {'auth_data.nick': params.email}])
      .exec(function(err, link) {
    if (err) {
      next(err);
      return;
    }

    if (!link || !link.checkPass(params.pass)) {
      // user not found or wrong password
      next({
        statusCode: 401,
        message: 'Authentication failed'
      });
    }

    // user found and say correct password
    User.findOne({ '_id': link.user_id }).setOptions({ lean: true })
        .select('_id').exec(function(err, user) {
      if (err){
        next(err);
        return;
      }

      env.session.me = user._id;

      next({
        statusCode: 302,
        // FIXME: get real back url
        headers: { Location: nodeca.runtime.router.linkTo('forum.index') }
      });
    });
  });
};
