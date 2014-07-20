// Activates user account.
// Check token. If token is correct create User and AuthLinks


'use strict';


var _ = require('lodash');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    secret_key: { type: 'string', required: true }
  });


  // Kick logged-in members
  //
  N.wire.before(apiPath, function register_guest_only(env, callback) {
    N.wire.emit('internal:users.redirect_not_guest', env, callback);
  });


  // Create default response (with failing state)
  //
  N.wire.before(apiPath, function prepare_response(env) {
    env.res.head.title = env.t('title');
    env.res.success = false; // Just initial value.
  });


  // Check auth token
  //
  N.wire.before(apiPath, function check_activation_token_and_user(env, callback) {

    N.models.users.TokenActivationEmail
        .findOne({ secret_key: env.params.secret_key, ip: env.req.ip })
        .exec(function (err, token) {

      if (err) {
        callback(err);
        return;
      }

      // No token found or it's expired. Show 'Invalid token' page.
      if (!token || token.isExpired()) {
        callback();
        return;
      }

      env.data.token = token;

      N.models.users.TokenActivationEmail.remove({ secret_key: env.params.secret_key }, callback);
    });
  });


  // Check nick uniqueness
  //
  N.wire.before(apiPath, function check_nick_uniqueness(env, callback) {

    var token = env.data.token;

    if (!token) {
      callback();
      return;
    }

    N.models.users.User
      .findOne({ 'nick': token.reg_info.nick })
      .select('_id')
      .lean(true)
      .exec(function (err, user) {

        if (err) {
          callback(err);
          return;
        }

        if (user) {
          // Need to terminate chain without 500 error
          env.data = _.omit(env.data, 'token');
          return;
        }

        callback();
      });
  });


  // Check email uniqueness. User email and oauth provider email should be unique
  //
  N.wire.before(apiPath, function check_email_uniqueness(env, callback) {

    var token = env.data.token;

    if (!token) {
      callback();
      return;
    }

    var emails = [ token.reg_info.email ];
    if (token.oauth_info) {
      emails.push(token.oauth_info.email);
    }

    N.models.users.AuthLink
      .findOne({ 'exist': true })
      .where('email').in(emails)
      .select('_id')
      .lean(true)
      .exec(function (err, authlink) {

        if (err) {
          callback(err);
          return;
        }

        if (authlink) {
          // Need to terminate chain without 500 error
          env.data = _.omit(env.data, 'token');
          return;
        }

        callback();
      });
  });


  // Create user record and login
  //
  N.wire.on(apiPath, function create_user(env, callback) {

    var token = env.data.token;

    if (!token) {
      callback();
      return;
    }

    env.data.reg_info = token.reg_info;
    env.data.oauth_info = token.oauth_info; // -> oauth_info

    N.wire.emit('internal:users.user_create', env, function (err) {
      if (err) {
        callback(err);
        return;
      }

      env.res.success = true;

      N.wire.emit('internal:users.login', env, function (err) {
        if (err) {
          callback(err);
          return;
        }

        env.res.redirect_url = env.data.redirect_url;
        callback();
      });
    });
  });
};
