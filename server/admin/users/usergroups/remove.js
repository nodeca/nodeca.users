// Remove user group
//
"use strict";


var _ = require('lodash');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    _id: {
      type: 'string',
      required: true,
      minLength: 24,
      maxLength: 24
    }
  });

  // Request handler
  //
  N.wire.on(apiPath, function (env, callback) {
    var UserGroup = N.models.users.UserGroup;
    var User = N.models.users.User;

    UserGroup.findById(env.params._id).exec(function(err, group) {
      if (err) {
        callback(err);
        return;
      }

      // not found
      if (!group) {
        callback(N.io.NOT_FOUND);
        return;
      }

      // group protected
      if (group.is_protected) {
        callback({
          code: N.io.BAD_REQUEST,
          data: {
            common: env.helpers.t('admin.users.usergroups.remove.error.protected')
          }
        });
        return;
      }

      // find children
      UserGroup.find({parent: group._id}).exec(function(err, children) {
        if (err) {
          callback(err);
          return;
        }

        if (!_.isEmpty(children)) {
          callback({
            code: N.io.BAD_REQUEST,
            data: {
              common: env.helpers.t('admin.users.usergroups.remove.error.has_children')
            }
          });
          return;
        }

        // find users associated with group
        User.find({ usergroups: group._id })
            .exec(function(err, users) {
          if (err) {
            callback(err);
            return;
          }
          if (!_.isEmpty(users)) {
            callback({
              code: N.io.BAD_REQUEST,
              data: {
                common: env.helpers.t('admin.users.usergroups.remove.error.not_empty')
              }
            });
            return;
          }
          group.remove(callback);
        });

      });
    });
  });
};
