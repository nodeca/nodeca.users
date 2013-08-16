// Resend email with account activation link.


'use strict';


var _ = require('lodash');

var sendActivationEmail = require('./_lib/send_activation_email');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});


  N.wire.before(apiPath, function find_validating_group_id(env, callback) {
    N.models.users.UserGroup.findIdByName('validating', function(err, id) {
      env.data.validatingGroupId = id;
      callback(err);
    });
  });


  N.wire.on(apiPath, function resend_activation(env, callback) {
    env.res.head.title = env.t('title');

    if (!env.session.user_id) {
      callback(N.io.NOT_AUTHORIZED);
      return;
    }

    N.models.users.User.findById(env.session.user_id, function (err, user) {
      if (err) {
        callback(err);
        return;
      }

      // Reject request if current user isn't in 'validating' group.
      if (-1 === user.usergroups.indexOf(env.data.validatingGroupId)) {
        callback({
          code: N.io.REDIRECT
        , head: { Location: N.runtime.router.linkTo('users.profile') }
        });
        return;
      }

      N.models.users.AuthLink
          .findOne({ user_id: user._id })
          .setOptions({ lean: true })
          .exec(function (err, authlink) {

        if (err) {
          callback(err);
          return;
        }

        if (!authlink) {
          callback(N.io.NOT_AUTHORIZED);
          return;
        }

        var plainProvider = _.find(authlink.providers, function (provider) {
          return 'plain' === provider.type;
        });

        if (!plainProvider) {
          callback(N.io.NOT_AUTHORIZED);
          return;
        }

        N.models.users.TokenActivationEmail.create({ user_id: user._id }, function (err, token) {
          if (err) {
            callback(err);
            return;
          }

          sendActivationEmail(N, env, plainProvider.email, token, callback);
        });
      });
    });
  });
};
