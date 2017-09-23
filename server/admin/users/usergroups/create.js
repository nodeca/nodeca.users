// Create user group

'use strict';


let PARAMS_SCHEMA = require('./_lib/params_schema');


module.exports = function (N, apiPath) {
  let UserGroup = N.models.users.UserGroup;


  N.validate(apiPath, PARAMS_SCHEMA);


  // Check if parent_group exists or is root.
  //
  N.wire.before(apiPath, async function check_usergroup_parent_ok(env) {
    // This is a root group.
    if (!env.params.parent_group) return;

    let count = await UserGroup.count({ _id: env.params.parent_group });

    if (count === 0) {
      throw {
        code: N.io.BAD_REQUEST,
        message: env.t('error_nonexistent_parent_group')
      };
    }
  });


  N.wire.on(apiPath, async function usergroup_create(env) {

    // Check if any group with the specified name exists.
    let count = await UserGroup.count({ short_name: env.params.short_name });

    if (count !== 0) {
      throw {
        code: N.io.BAD_REQUEST,
        message: env.t('error_short_name_busy')
      };
    }

    // Raw settings contains interface state:
    // - Full settings list for Root groups
    // - List of overriden settings for inherited groups
    //
    // We store interface data separately, and then use it
    // to calculate final `store` values (permissions)
    //
    // See ./_lib/params_schema.js for details on raw settings format.
    let group = new UserGroup({
      short_name:   env.params.short_name,
      parent_group: env.params.parent_group
    });

    await group.save();

    // Recalculate store settings of all groups.
    let store = N.settings.getStore('usergroup');

    if (!store) throw 'Settings store `usergroup` is not registered.';

    await store.set(env.params.settings, { usergroup_id: group._id });
  });
};
