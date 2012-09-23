"use strict";

/*global nodeca, _*/

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
    minLength: 4,
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

  // FIXME get real back url
  var back_url = nodeca.runtime.router.linkTo('forum.index');


  // check existing links
  AuthLink.find({ 'providers.email': params.email }).setOptions({ lean: true })
      .limit(1).exec(function(err, docs){
    if (err) {
      next(err);
      return;
    }
    // is email uniq?
    if (docs.length !== 0) {
      // FIXME check statusCode
      next({ statusCode: 401, body: 'This email already exists' });
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
        // all ok
        next();
      });
    });
  });
};
