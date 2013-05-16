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
        callback(N.io.NOT_FOUND);
        return;
      }

      if (group.is_protected) {
        callback({
          code: N.io.CLIENT_ERROR
        , message: env.helpers.t('admin.users.usergroups.destroy.error_protected')
        });
        return;
      }

      // Count children.
      UserGroup.count({ parent: group._id }).exec(function(err, childrenCount) {
        if (err) {
          callback(err);
          return;
        }

        if (0 !== childrenCount) {
          callback({
            code: N.io.CLIENT_ERROR
          , message: env.helpers.t('admin.users.usergroups.destroy.error_has_children')
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
              code: N.io.CLIENT_ERROR
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
