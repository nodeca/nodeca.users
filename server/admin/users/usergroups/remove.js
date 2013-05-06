'use strict';


var _ = require('lodash');


module.exports = function (N, apiPath) {
  var UserGroup = N.models.users.UserGroup
    , User      = N.models.users.User;


  N.validate(apiPath, {
    _id: {
      type: 'string'
    , required: true
    , minLength: 24
    , maxLength: 24
    }
  });


  N.wire.on(apiPath, function (env, callback) {
    UserGroup.findById(env.params._id).exec(function(err, group) {
      if (err) {
        callback(err);
        return;
      }

      if (!group) {
        callback(N.io.NOT_FOUND);
        return;
      }

      if (group.is_protected) {
        callback({
          code: N.io.BAD_REQUEST
        , message: env.helpers.t('admin.users.usergroups.remove.error.protected')
        });
        return;
      }

      // Find children.
      UserGroup.find({ parent: group._id }).exec(function(err, children) {
        if (err) {
          callback(err);
          return;
        }

        if (!_.isEmpty(children)) {
          callback({
            code: N.io.BAD_REQUEST
          , message: env.helpers.t('admin.users.usergroups.remove.error.has_children')
          });
          return;
        }

        // Find users associated with the group.
        User.find({ usergroups: group._id }).exec(function(err, users) {
          if (err) {
            callback(err);
            return;
          }

          if (!_.isEmpty(users)) {
            callback({
              code: N.io.BAD_REQUEST
            , message: env.helpers.t('admin.users.usergroups.remove.error.not_empty')
            });
            return;
          }

          group.remove(callback);
        });
      });
    });
  });
};
