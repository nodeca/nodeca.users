// Apply new password entered by user.


'use strict';


var _ = require('lodash');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    secret_key:   { type: 'string', required: true }
  , new_password: { type: 'string', required: true }
  });

  N.wire.on(apiPath, function (env, callback) {
    if (!N.models.users.User.validatePassword(env.params.new_password)) {
      callback(N.io.CLIENT_ERROR);
      return;
    }

    N.models.users.TokenResetPassword.findOne({
      secret_key: env.params.secret_key
    }, function (err, token) {
      if (err) {
        callback(err);
        return;
      }

      if (!token || token.isExpired()) {
        callback({
          code:    N.io.NOT_FOUND
        , message: env.t('expired_token')
        });
        return;
      }

      N.models.users.AuthLink.findById(token.authlink_id, function (err, authlink) {
        if (err) {
          callback(err);
          return;
        }

        var provider = _.find(authlink.providers, function (provider) {
          return provider._id.equals(token.authprovider_id);
        });

        if (!provider) {
          callback({
            code:    N.io.NOT_FOUND
          , message: env.t('broken_token')
          });
          return;
        }

        provider.setPass(env.params.new_password);

        // Remove current and all other password reset tokens for this provider.
        N.models.users.TokenResetPassword.remove({
          authprovider_id: provider._id
        }, function (err) {
          if (err) {
            callback(err);
            return;
          }

          // Save new password.
          authlink.save(callback);
        });
      });
    });
  });
};
