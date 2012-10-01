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
    type: "string"
  },
  recaptcha_response_field: {
    type: "string"
  }
};
nodeca.validate(params_schema);



// find_auth(email, callback) -> Void
// - email (String): email or nick
// - callback(function): callback function with params err and link(AuthLink)
//
// find authentication info by user email or nickname
//
function find_auth(email, callback) {
  AuthLink.findOne({ 'providers.type': 'plain', 'providers.email': email })
      .exec(function(err, link) {
    if (err) {
      callback(err);
      return;
    }

    // email found -> OK
    if (link) {
      callback(null, link);
      return;
    }

    // email not found -> try to find by nickname
    User.findOne({ 'nick': email }).setOptions({ lean: true })
      .select('_id').exec(function(err, user) {
      if (err) {
        callback(err);
        return;
      }

      // no user -> no auth data
      if (!user) {
        callback(null, null);
      }

      AuthLink.findOne({'user_id': user._id}).exec(callback);

    });
  });
}


/**
 * users.auth.login.plain.exec(params, next) -> Void
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

    // Bad captcha code -> return error to client
    if (!result) {
      next({
        statusCode: 401,
        body: {
          recaptcha: '' // don't customize form text, just highlight field
        }
      });
      return;
    }

    // try find auth info by email or nick
    find_auth(params.email, function(err, auth) {
      var provider;
      var login_error = {
            statusCode: 401,
            body: {
              common: env.helpers.t('users.auth.login_form.error.login_failed')
            }
          };

      if (err) {
        next(err);
        return;
      }

      // No auth info
      if (!auth) {
        next(login_error);
      }

      // extract found provider subdoc
      provider = _.find(auth.providers, function(el) {
        return el.type === 'plain';
      });

      // check password
      if (!provider.checkPass(params.pass)) {
        next(login_error);
        return;
      }

      // all ok -> write user to session
      env.session.user_id = auth.user_id;
      next();
    });
  });
};
