"use strict";

/*global nodeca, _*/
var NLib = require('nlib');
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
    required: true
  },
  recaptcha_challenge_field: {
    type: "string",
    required: true
  },
  recaptcha_response_field: {
    type: "string",
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
  
  var private_key = nodeca.config.recaptcha.private_key;
  var user_ip = env.request.ip;
  var challenge = params.recaptcha_challenge_field;
  var response = params.recaptcha_response_field;

  NLib.ReCaptcha.verify(private_key, user_ip, challenge, response, function(err){
    if (err) {
      next(err);
    }
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
          body: env.helpers.t('users.auth.login_form.error')
        });
      }

      // user found and say correct password
      User.findOne({ '_id': link.user_id }).setOptions({ lean: true })
          .select('_id').exec(function(err, user) {
        if (err){
          next(err);
          return;
        }

        env.session.user_id = user._id;

        next();
      });
    });
  });
};
