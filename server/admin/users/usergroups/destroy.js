// Delete user group

'use strict';


module.exports = function (N, apiPath) {
  let UserGroup = N.models.users.UserGroup,
      User      = N.models.users.User;


  N.validate(apiPath, {
    _id: { format: 'mongo', required: true }
  });


  // Search group & check protection
  //
  N.wire.before(apiPath, function* usergroup_search(env) {

    let group = yield UserGroup.findById(env.params._id);

    if (!group) {
      throw {
        code: N.io.BAD_REQUEST,
        message: env.t('error_not_exists')
      };
    }

    if (group.is_protected) {
      throw {
        code: N.io.BAD_REQUEST,
        message: env.t('error_protected')
      };
    }

    env.data.userGroup = group;
  });


  // Check that no inherited groups exists
  //
  N.wire.before(apiPath, function* usergroup_check_childs(env) {

    let child = yield UserGroup.findOne({ parent_group: env.data.userGroup._id }).lean(true);

    if (child) {
      throw {
        code: N.io.BAD_REQUEST,
        message: env.t('error_has_children', { name: child.short_name })
      };
    }
  });


  N.wire.on(apiPath, function* usergroup_delete(env) {
    let group = env.data.userGroup;

    // Delete only if no users in group.
    let usersCount = yield User.count({ usergroups: group._id });

    if (usersCount !== 0) {
      throw {
        code: N.io.BAD_REQUEST,
        message: env.t('error_not_empty')
      };
    }

    yield group.remove();
  });
};
