"use strict";

/*global nodeca, _*/
var NLib = require('nlib');
var Async = NLib.Vendor.Async;
var ReCaptcha = NLib.ReCaptcha;

var AuthLink = nodeca.models.users.AuthLink;
var User = nodeca.models.users.User;


// Validate input parameters
//
var params_schema = {
  email: {
    type: "string",
    format: "email",
    required: true
  },
  pass: {
    type: "string",
    minLength: 8,
    required: true
  },
  nick: {
    type: "string",
    minLength: 1,
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


/**
 * users.auth.register.exec(params, callback) -> Void
 *
 * ##### Params
 * - email(String):       Email
 * - pass(String):        Password
 * - nick(String):        Nickname
 *
 * Register new user
 *
 **/
module.exports = function (params, next) {
  var env = this;
  var user;

  var errors = {};

  Async.series([
    // recaptcha validation
    function(callback) {
      var private_key = nodeca.config.recaptcha.private_key;
      var user_ip = env.request.ip;
      var challenge = params.recaptcha_challenge_field;
      var response = params.recaptcha_response_field;

      ReCaptcha.verify(private_key, user_ip, challenge, response, function(err, result){
        if (err) {
          callback(err);
          return;
        }

        // user send wrong captcha code
        // don't customize form text, just highlight field
        if (!result) {
          errors['recaptcha'] = '';
        }
        callback();
      });
    },

    // is email unique?
    function(callback) {
      AuthLink.findOne({ 'providers.email': params.email }).setOptions({ lean: true })
          .exec(function(err, doc){
        if (err) {
          callback(err);
          return;
        }

        // Accumulate error and continue check next params
        if (doc) {
          errors['email'] = env.helpers.t('users.auth.reg_form.error.email_busy');
        }

        callback();
      });
    },

    // is nick unque?
    function(callback) {
      User.findOne({ 'nick': params.nick}).setOptions({ lean: true })
          .exec(function(err, doc){
        if (err) {
          callback(err);
          return;
        }

        // Accumulate error and continue check next params
        if (doc) {
          errors['nick'] = env.helpers.t('users.auth.reg_form.error.nick_busy');
        }
      
        callback();
      });
    }
  
  ], function(err) {
    if (err) {
      next(err);
    }

    // if problem with params - return error
    if (!_.isEmpty(errors)) {
      next({
        statusCode: nodeca.io.BAD_REQUEST,
        body: errors
      });
      return;
    }

    // Start creating user.

    user = new User(params);
    user.joined_ts = new Date();
    user.joined_ip = env.request.ip;
    // FIXME set groups

    user.save(function(err, user) {
      var auth,
          provider;

      if (err) {
        next(err);
        return;
      }

      auth = new AuthLink({ 'user_id': user._id });

      provider = auth.providers.create({
        'type': 'plain',
        'email': params.email
      });
      provider.setPass(params.pass);

      auth.providers.push(provider);

      auth.save(next());
    });
  });
};
