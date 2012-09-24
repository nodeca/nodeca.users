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
    type: "string",
  },
  recaptcha_response_field: {
    type: "string",
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

  // FIXME get real back url
  var back_url = nodeca.runtime.router.linkTo('forum.index');

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
        if (!result) {
          errors['recaptcha'] = env.helpers.t('common.recaptcha.fail');
        }
        callback();
      });
    },
    // is email uniq?
    function(callback) {
      AuthLink.findOne({ 'providers.email': params.email }).setOptions({ lean: true })
          .exec(function(err, doc){
        if (err) {
          callback(err);
          return;
        }
        if (!_.isEmpty(doc)) {
          errors['email'] = env.helpers.t('users.auth.reg_form.errors.email_exists');
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
        if (!_.isEmpty(doc)) {
          errors['nick'] = env.helpers.t('users.auth.reg_form.errors.nick_exists');
        }
      
        callback();
      });
    }
  
  ], function(err) {
    if (err) {
      next(err);
    }
    if (!_.isEmpty(errors)) {
      next({
        statusCode: 401,
        body: errors
      });
      return;
    }

    user = new User(params);
    user._last_visit_ts = user.joined_ts = new Date();
    user._last_visit_ip = env.request.ip;
    user.locale = nodeca.config.locales['default'];
    // FIXME set groups

    user.save(function(err, user) {
      var link,
          provider;

      if (err) {
        next(err);
        return;
      }

      link = new AuthLink({ 'user_id': user._id });
      provider = link.providers.create({
        'provider': 'email',
        'email': params.email
      });
      provider.setPass(params.pass);
      link.providers.push(provider);

      link.save(function(err, link){
        if (err) {
          next(err);
          return;
        }
        next();
      });
    });
  });
};
