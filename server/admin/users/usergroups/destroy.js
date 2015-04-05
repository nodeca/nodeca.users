// Delete user group

'use strict';


module.exports = function (N, apiPath) {
  var UserGroup = N.models.users.UserGroup,
      User      = N.models.users.User;


  N.validate(apiPath, {
    _id: { format: 'mongo', required: true }
  });


  // Search group & check protection
  //
  N.wire.before(apiPath, function usergroup_search(env, callback) {

    UserGroup.findById(env.params._id).exec(function (err, group) {

      if (err) {
        callback(err);
        return;
      }

      if (!group) {
        callback({
          code: N.io.BAD_REQUEST,
          message: env.t('error_not_exists')
        });
        return;
      }

      if (group.is_protected) {
        callback({
          code: N.io.BAD_REQUEST,
          message: env.t('error_protected')
        });
        return;
      }

      env.data.userGroup = group;

      callback();
    });
  });


  // Check that no inherited groups exists
  //
  N.wire.before(apiPath, function usergroup_check_childs(env, callback) {

    UserGroup.findOne({ parent_group: env.data.userGroup._id })
        .lean(true)
        .exec(function (err, child) {

      if (err) {
        callback(err);
        return;
      }

      if (child) {
        callback({
          code: N.io.BAD_REQUEST,
          message: env.t('error_has_children', { name: child.short_name })
        });
        return;
      }

      callback();
    });
  });


  N.wire.on(apiPath, function usergroup_delete(env, callback) {
    var group = env.data.userGroup;

    // Delete only if no users in group.
    User.count({ usergroups: group._id }).exec(function (err, usersCount) {
      if (err) {
        callback(err);
        return;
      }

      if (usersCount !== 0) {
        callback({
          code: N.io.BAD_REQUEST,
          message: env.t('error_not_empty')
        });
        return;
      }

      group.remove(callback);
    });
  });
};
