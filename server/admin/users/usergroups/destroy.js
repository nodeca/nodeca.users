// Delete user group

'use strict';


module.exports = function (N, apiPath) {
  var UserGroup = N.models.users.UserGroup
    , User      = N.models.users.User;


  N.validate(apiPath, {
    _id: {
      type: 'string'
    , required: true
    }
  });


  N.wire.on(apiPath, function (env, callback) {
    UserGroup.findById(env.params._id).exec(function(err, group) {
      if (err) {
        callback(err);
        return;
      }

      if (!group) {
        callback({
          code: N.io.BAD_REQUEST
        , message: env.helpers.t('admin.users.usergroups.destroy.error_not_exists')
        });
        return;
      }

      if (group.is_protected) {
        callback({
          code: N.io.BAD_REQUEST
        , message: env.helpers.t('admin.users.usergroups.destroy.error_protected')
        });
        return;
      }

      // Try to find any child.
      UserGroup.findOne({ parent_group: group._id }).exec(function(err, child) {
        if (err) {
          callback(err);
          return;
        }

        if (child) {
          callback({
            code: N.io.BAD_REQUEST
          , message: env.helpers.t('admin.users.usergroups.destroy.error_has_children', {
              name: child.short_name
            })
          });
          return;
        }

        // Count users associated with the group.
        User.count({ usergroups: group._id }).exec(function(err, usersCount) {
          if (err) {
            callback(err);
            return;
          }

          if (0 !== usersCount) {
            callback({
              code: N.io.BAD_REQUEST
            , message: env.helpers.t('admin.users.usergroups.destroy.error_not_empty')
            });
            return;
          }

          group.remove(callback);
        });
      });
    });
  });
};
