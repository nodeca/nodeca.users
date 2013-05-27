// Remove 'validating' group from a user account using secret token sent
// by email.


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    secret_key: { type: 'string', required: true }
  });


  N.wire.before(apiPath, function find_validating_group_id(env, callback) {
    N.models.users.UserGroup.findIdByName('validating', function(err, id) {
      env.data.validatingGroupId = id;
      callback(err);
    });
  });


  N.wire.before(apiPath, function find_validated_group_id(env, callback) {
    N.settings.get('register_user_validated_group', {}, function (err, id) {
      env.data.validatedGroupId = id;
      callback(err);
    });
  });


  N.wire.on(apiPath, function register_activate(env, callback) {
    env.response.data.head.title = env.helpers.t('users.auth.register.title');

    N.models.users.TokenActivationEmail
        .findOne({ secret_key: env.params.secret_key })
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

      N.models.users.AuthLink
          .findOne({ 'providers.email': token.email, 'providers.type': 'plain' })
          .exec(function (err, authlink) {

        if (err) {
          callback(err);
          return;
        }

        // No authlink found. Remove the token and show 'Invalid token' page.
        if (!authlink) {
          token.remove(callback);
          return;
        }

        N.models.users.User.findById(authlink.user_id, function (err, user) {
          if (err) {
            callback(err);
            return;
          }

          // No user found. Remove the token and show 'Invalid token' page.
          if (!user) {
            token.remove(callback);
            return;
          }

          user.usergroups.remove(env.data.validatingGroupId);
          user.usergroups.push(env.data.validatedGroupId);

          user.save(function (err) {
            if (err) {
              callback(err);
              return;
            }

            env.response.data.success = true;

            // Remove all ever created tokens for the activated email.
            N.models.users.TokenActivationEmail.find({ email: token.email }).remove(callback);
          });
        });
      });
    });
  });
};
