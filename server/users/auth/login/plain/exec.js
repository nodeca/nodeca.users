"use strict";

/*global nodeca, _*/
var ReCaptcha = require('nlib').ReCaptcha;
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
  },
  recaptcha_response_field: {
    type: "string",
  }
};
nodeca.validate(params_schema);



// find_user(email, callback) -> Void
// - email (String): email or nick
// - callback(function): callback function with params err and link(AuthLink)
//
// find user by email or nick
function find_user(email, callback) {
  AuthLink.findOne({ 'providers.provider': 'email', 'providers.email': email })
      .exec(function(err, link) {
    if (err) {
      callback(err);
      return;
    }
    if (!!link) {
      callback(err, link);
      return;
    }
    // try find by nickname
    User.findOne({ 'nick': email }).setOptions({ lean: true })
      .select('_id').exec(function(err, user) {
      if (err || !user) {
        callback(err);
        return;
      }
      AuthLink.findOne({'user_id': user._id}).exec(callback);
    });
  });
}


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

  ReCaptcha.verify(private_key, user_ip, challenge, response, function(err, result){
    if (err) {
      next(err);
      return;
    }

    // user send wrong captcha code
    if (!result) {
      next({
        statusCode: 401,
        body: {
          recaptcha: env.helpers.t('common.recaptcha.code_incorrect')
        }
      });
      return;
    }

    // try find user by email or nick
    find_user(params.email, function(err, link) {
      var provider;
      if (!!link) {
        provider = _.find(link.providers, function(el) {
          return el.provider === 'email';
        });
      }
      // user not found or wrong password
      if (!provider || !provider.checkPass(params.pass)) {
        next({
          statusCode: 401,
          body: {
            auth: env.helpers.t('users.auth.login_form.error')
          }
        });
        return;
      }

      // all ok, write user to session
      env.session.user_id = link.user_id;
      next();
    });
  });
};
