// Remove 'validating' group from a user account using secret token sent
// by email.


'use strict';


var async = require('async');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    user_id:    { type: 'string', required: true }
  , secret_key: { type: 'string', required: true }
  });


  N.wire.before(apiPath, function find_members_group_id(env, callback) {
    N.models.users.UserGroup
        .findOne({ short_name: 'members' })
        .select('_id')
        .setOptions({ lean: true })
        .exec(function (err, group) {

      if (err) {
        callback(err);
        return;
      }

      if (!group) {
        callback(new Error('Unable to find special usergroup "members"'));
        return;
      }

      env.data.membersGroupId = group._id;
      callback();
    });
  });


  N.wire.before(apiPath, function find_validating_group_id(env, callback) {
    N.models.users.UserGroup
        .findOne({ short_name: 'validating' })
        .select('_id')
        .setOptions({ lean: true })
        .exec(function (err, group) {

      if (err) {
        callback(err);
        return;
      }

      if (!group) {
        callback(new Error('Unable to find special usergroup "validating"'));
        return;
      }

      env.data.validatingGroupId = group._id;
      callback();
    });
  });


  N.wire.on(apiPath, function confirm_email(env, callback) {
    N.models.users.User.findById(env.params.user_id, function (err, user) {
      if (err) {
        callback(err);
        return;
      }

      // No user found.
      if (!user) {
        callback(); // Show 'error' page.
        return;
      }

      N.models.users.TokenConfirmEmail
          .findOne({ user_id: user._id, secret_key: env.params.secret_key })
          .exec(function (err, token) {

        if (err) {
          callback(err);
          return;
        }

        // No token found or it's expired.
        if (!token || !token.check()) {
          callback(); // Show 'error' page.
          return;
        }

        env.response.data.success = true;

        user.usergroups.remove(env.data.validatingGroupId);
        user.usergroups.push(env.data.membersGroupId);

        async.series([token.remove.bind(token), user.save.bind(user)], callback);
      });
    });
  });
};
