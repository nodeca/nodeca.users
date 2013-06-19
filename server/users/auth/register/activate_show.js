// Remove 'validating' group from a user account using secret token sent
// by email.


'use strict';


var login = require('nodeca.users/lib/login');


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
    N.settings.get('register_user_validated_group', function (err, id) {
      env.data.validatedGroupId = id;
      callback(err);
    });
  });


  N.wire.on(apiPath, function register_activate(env, callback) {
    env.response.data.head.title = env.t('title');
    env.response.data.success = false; // Just initial value.

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

      N.models.users.User.findById(token.user_id, function (err, user) {
        if (err) {
          callback(err);
          return;
        }

        // No user found. Remove the token and show 'Invalid token' page.
        if (!user) {
          token.remove(callback);
          return;
        }

        // Reject activation of already activated account.
        // NOTE: This must not happen on normal Nodeca workflow.
        if (-1 === user.usergroups.indexOf(env.data.validatingGroupId)) {
          token.remove(callback);
          return;
        }

        user.usergroups.remove(env.data.validatingGroupId);

        // Push the validated group only if user isn't already member of that.
        if (-1 === user.usergroups.indexOf(env.data.validatedGroupId)) {
          user.usergroups.push(env.data.validatedGroupId);
        }

        // Ensure all ever created tokens are deleted *before* saving
        // the account and auto-login.
        N.models.users.TokenActivationEmail.find({ user_id: user._id }).remove(function (err) {
          if (err) {
            callback(err);
            return;
          }

          user.save(function (err, user) {
            if (err) {
              callback(err);
              return;
            }

            env.response.data.success = true;

            // Auto-login.
            if (!env.session.user_id) {
              login(env, user._id);
            }

            callback();
          });
        });
      });
    });
  });
};
