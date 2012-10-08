"use strict";

/*global nodeca, _*/

var ReCaptcha = require('nlib').ReCaptcha;

var AuthLink = nodeca.models.users.AuthLink;
var User = nodeca.models.users.User;

var rate = require('../_rate_limit.js');

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
function find_auth(env, email, callback) {
  AuthLink.findOne({ 'providers.type': 'plain', 'providers.email': email })
      .exec(function (err, auth) {
    if (err) {
      callback(err);
      return;
    }

    // email found -> OK
    if (auth) {
      User.findOne({ '_id': auth.user_id }).setOptions({ lean: true })
          .exec(function (err, user) {
        if (err) {
          callback(err);
          return;
        }
        if (!user) {
          callback({
            statusCode: nodeca.io.APP_ERROR,
            body: env.helpers.t('users.auth.login_form.error.auth_user_broken')
          });
          return;
        }
        callback(null, auth);
        return;
      });
      return;
    }

    // email not found -> try to find by nickname
    User.findOne({ 'nick': email }).setOptions({ lean: true })
      .select('_id').exec(function (err, user) {
      if (err) {
        callback(err);
        return;
      }

      // no user -> no auth data
      if (!user) {
        callback(null, null);
        return;
      }

      AuthLink.findOne({ 'providers.type': 'plain', 'user_id': user._id }).exec(callback);

    });
  });
}


// Check captcha, but only when needed (too many total login attempts)
//
function check_captcha(env, params, callback) {

  // check big requests count first
  rate.total.count(function (err, high) {
    if (err) {
      callback(err);
      return;
    }

    // no high load - skip captcha
    if (!high) {
      callback();
      return;
    }

    // high load - need to check captcha.
    //
    // !!! That will cause error, when system switched from "no captcha"
    // to "protected" mode !!!
    // (if ddos started exactly between form get and submit)
    //
    // But since this situation in very rare (only on DDoS start), we consider
    // it as acceptable tradeoff for significant algorythm simplification
    // (no need to track captcha state in each session)

    var private_key = nodeca.config.recaptcha.private_key;
    var user_ip = env.request.ip;
    var challenge = params.recaptcha_challenge_field;
    var response = params.recaptcha_response_field;

    ReCaptcha.verify(private_key, user_ip, challenge, response, function (err, result) {
      if (err) {
        callback(err);
        return;
      }

      // Bad captcha code -> return error to client
      if (!result) {
        callback({
          statusCode: nodeca.io.BAD_REQUEST,
          body: {
            recaptcha: '' // don't customize form text, just highlight field
          }
        });
        return;
      }

      callback();
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
  var env = this,
      user_ip = env.request.ip;
  
  // We should protect login in 2 ways:
  //
  // 1. Too many total logins (60 attempts / 60 seconds).
  //    That can cause too hight CPU use in bcrypt.
  //    Do soft limit - ask user to enter captcha, to make shure,
  //    he is not bot.
  //
  // 2. Too many invalid ligins (5 attempts / 300 seconds) from single IP
  //    Do hard limit - ask user to wait 5 minutes

  rate.ip.count(user_ip, function (err, high) {
    if (err) {
      next(err);
      return;
    }

    // too many login attempts from single IP detected - return error,
    // without check, and update counters.
    if (high) {
      // update fail counters in lazy style - don't wait callback
      rate.ip.update(user_ip);
      rate.total.update();

      next({
        statusCode: nodeca.io.APP_ERROR,
        message: env.helpers.t('users.auth.login_form.error.too_many_attempts')
      });
      return;
    }

    check_captcha(env, params, function (err) {
      if (err) {
        next(err);
        return;
      }

      // try find auth info by email or nick
      find_auth(env, params.email, function (err, auth) {
        var provider;
        var login_error = {
          statusCode: nodeca.io.BAD_REQUEST,
          body: { common: env.helpers.t('users.auth.login_form.error.login_failed') }
        };

        if (err) {
          next(err);
          return;
        }

        // No auth info
        if (!auth) {
          // update fail counters in lazy style - don't wait callback
          rate.ip.update(user_ip);
          rate.total.update();

          next(login_error);
          return;
        }

        // extract found provider subdoc
        provider = _.find(auth.providers, function (el) {
          return el.type === 'plain';
        });

        // check password
        if (!provider.checkPass(params.pass)) {
          // update fail counters in lazy style - don't wait callback
          rate.ip.update(user_ip);
          rate.total.update();

          next(login_error);
          return;
        }

        // all ok -> write user to session
        env.session.user_id = auth.user_id;
        next();
      });
    });
  });
};
