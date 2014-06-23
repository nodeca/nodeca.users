// Apply new password entered by user.


'use strict';


var _     = require('lodash');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    secret_key:   { type: 'string', required: true }
  , new_password: { type: 'string', required: true }
  });


  N.wire.before(apiPath, function change_pass_guest_only(env, callback) {
    N.wire.emit('internal:users.redirect_not_guest', env, callback);
  });


  // Validate new password
  //
  N.wire.before(apiPath, function validate_new_password(env) {
    if (!N.models.users.User.validatePassword(env.params.new_password)) {
      throw {
        code:         N.io.CLIENT_ERROR,
        message:      null,
        bad_password: true
      }
    }
  });


  // Check token
  //
  N.wire.before(apiPath, function check_new_pass_token(env, callback) {

    N.models.users.TokenResetPassword.findOne({
      secret_key: env.params.secret_key
    }, function (err, token) {

      if (err) {
        callback(err);
        return;
      }

      if (!token || token.isExpired()) {
        callback({
          code:         N.io.CLIENT_ERROR
        , message:      env.t('expired_token')
        , bad_password: false
        });
        return;
      }

      env.data.token = token;

      callback();
    });
  });


  // Fetch user authlink/provider data
  //
  N.wire.before(apiPath, function fetch_user_auth_data(env, callback) {
    var token = env.data.token;

    N.models.users.AuthLink.findById(token.authlink_id, function (err, authlink) {
      if (err) {
        callback(err);
        return;
      }

      if (!authlink) {
        callback({
          code:         N.io.CLIENT_ERROR,
          message:      env.t('broken_token'),
          bad_password: false
        });
        return;
      }

      var provider = _.find(authlink.providers, function (provider) {
        return provider._id.equals(token.authprovider_id);
      });

      if (!provider) {
        callback({
          code:         N.io.CLIENT_ERROR,
          message:      env.t('broken_token'),
          bad_password: false
        });
        return;
      }

      env.data.provider = provider;
      callback();
    });
  });


  // Update password & remove used token
  //
  N.wire.on(apiPath, function (env, callback) {
    var provider = env.data.provider;

    provider.setPass(env.params.new_password, function (err) {
      if (err) {
        callback(err);
        return;
      }

      // Remove current and all other password reset tokens for this provider.
      N.models.users.TokenResetPassword.remove({
        authprovider_id: provider._id
      }, function (err) {
        if (err) {
          callback(err);
          return;
        }

        // Save new password.
        env.data.authlink.save(callback);
      });
    });
  });


  // Auto login after password change
  //
  N.wire.after(apiPath, function autologin(env, callback) {

    N.models.users.User.findById(env.data.authlink.user_id, function (err, user) {
      if (err) {
        callback(err);
        return;
      }

      env.data.user = user;
      N.wire.emit('internal:users.login', env, callback);
    });
  });
};
