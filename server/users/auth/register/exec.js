// Register new user
//
"use strict";


var _ = require('lodash');
var async = require('async');


var ReCaptcha = require('nodeca.core/lib/recaptcha.js');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
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
  });


  // Request handler
  //
  // ##### Params
  // - email(String):       Email
  // - pass(String):        Password
  // - nick(String):        Nickname
  //
  N.wire.on(apiPath, function (env, callback) {
    // model links
    var AuthLink = N.models.users.AuthLink
      , User = N.models.users.User
      , params = env.params;

    var errors = {};

    async.series([
      // recaptcha validation
      function (next) {
        var private_key = N.config.options.recaptcha.private_key;
        var user_ip = env.request.ip;
        var challenge = params.recaptcha_challenge_field;
        var response = params.recaptcha_response_field;

        ReCaptcha.verify(private_key, user_ip, challenge, response, function (err, result) {
          if (err) {
            next(err);
            return;
          }

          // user send wrong captcha code
          // don't customize form text, just highlight field
          if (!result) {
            errors['recaptcha'] = '';
          }
          next();
        });
      },

      // is email unique?
      function (next) {
        AuthLink.findOne({ 'providers.email': params.email }).setOptions({ lean: true })
            .exec(function (err, doc) {
          if (err) {
            next(err);
            return;
          }

          // Accumulate error and continue check next params
          if (doc) {
            errors['email'] = env.helpers.t('users.auth.register.exec.error.email_busy');
          }

          next();
        });
      },

      // is nick unque?
      function (next) {
        User.findOne({ 'nick': params.nick}).setOptions({ lean: true })
            .exec(function (err, doc) {
          if (err) {
            next(err);
            return;
          }

          // Accumulate error and continue check next params
          if (doc) {
            errors['nick'] = env.helpers.t('users.auth.register.exec.error.nick_busy');
          }

          next();
        });
      }

    ],

    function (err) {
      if (err) {
        callback(err);
      }

      // if problem with params - return error
      if (!_.isEmpty(errors)) {
        callback({ code: N.io.BAD_REQUEST, data: errors });
        return;
      }

      // Start creating user.
      var new_user;

      new_user = new User(params);
      new_user.joined_ts = new Date();
      new_user.joined_ip = env.request.ip;

      // FIXME set groups

      new_user.save(function (err, user) {
        var auth,
            provider;

        if (err) {
          callback(err);
          return;
        }

        auth = new AuthLink({ 'user_id': user._id });

        provider = auth.providers.create({
          'type': 'plain',
          'email': params.email
        });
        provider.setPass(params.pass);

        auth.providers.push(provider);

        auth.save(callback);
      });
    });
  });
};
