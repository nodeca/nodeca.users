"use strict";

/*global nodeca, _*/

var ReCaptcha = nodeca.components.ReCaptcha;

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
            code: nodeca.io.APP_ERROR,
            data: env.helpers.t('users.auth.login_form.error.auth_user_broken')
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


// Check big request count from single IP. That can be brute force attempt.
//
nodeca.filters.before('@', function login_ip_rate_limit(params, next) {
  var env = this,
      user_ip = env.request.ip;
 
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
        code: nodeca.io.APP_ERROR,
        data: env.helpers.t('users.auth.login_form.error.too_many_attempts')
      });
      return;
    }

    next();
  });
});


// Check captcha, but only when needed (too many total login attempts)
//
nodeca.filters.before('@', function login_check_captcha(params, next) {
  var env = this;

  // check big requests count first
  rate.total.count(function (err, high) {
    if (err) {
      next(err);
      return;
    }

    // no high load - skip captcha
    if (!high) {
      next();
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
        next(err);
        return;
      }

      // Bad captcha code -> return error to client
      if (!result) {
        next({
          code: nodeca.io.BAD_REQUEST,
          data: {
            recaptcha: '' // don't customize form text, just highlight field
          }
        });
        return;
      }

      next();
    });
  });
});


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
  // 1. Too many invalid logins (5 attempts / 300 seconds) from single IP
  //    Do hard limit - ask user to wait 5 minutes
  //
  // 2. Too many total logins (60 attempts / 60 seconds).
  //    That can cause too hight CPU use in bcrypt.
  //    Do soft limit - ask user to enter captcha, to make shure,
  //    he is not bot.
  //
  // Both done on filters


  // try find auth info by email or nick
  find_auth(env, params.email, function (err, auth) {
    var provider;
    var login_error = {
      code: nodeca.io.BAD_REQUEST,
      data: { common: env.helpers.t('users.auth.login_form.error.login_failed') }
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
};
