// Activates user account.
// Check token. If token is correct - create User and AuthLink records.


'use strict';


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
        .lean(false) // because we use model's instance method 'isExpired'
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

      // Token can be used only once.
      N.models.users.TokenActivationEmail.remove({ secret_key: env.params.secret_key }, callback);
    });
  });

  //
  // That's almost impossible, but someone could occupy nick/email if user
  // activated account too late. Or if user started registration twice and
  // got 2 emails. So, we check again that nick & emails are unique.
  //

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
        .exec(function (err, id) {

      if (err) {
        callback(err);
        return;
      }

      if (id) {
        // Need to terminate chain without 500 error.
        // If user exists - kill fetched token as invalid.
        env.data.token = null;
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
        .findOne({ exists: true })
        .where('email').in(emails)
        .select('_id')
        .lean(true)
        .exec(function (err, id) {

      if (err) {
        callback(err);
        return;
      }

      if (id) {
        // Need to terminate chain without 500 error.
        // If email(s) occupied - kill fetched token as invalid.
        env.data.token = null;
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
