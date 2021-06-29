// Save settings for specified group

'use strict';


const detectCircular = require('./_lib/detect_circular');
const PARAMS_SCHEMA  = require('./_lib/params_schema');


module.exports = function (N, apiPath) {
  let UserGroup = N.models.users.UserGroup;


  N.validate(apiPath, Object.assign({
    _id: { format: 'mongo', required: true }
  }, PARAMS_SCHEMA));


  // If parent specified, check it's existance
  //
  N.wire.before(apiPath, async function usergroup_check_parent(env) {
    // This is a root group.
    if (!env.params.parent_group) return;

    let count = await UserGroup.countDocuments({ _id: env.params.parent_group });

    if (count === 0) {
      throw {
        code: N.io.BAD_REQUEST,
        message: env.t('error_nonexistent_parent_group')
      };
    }
  });


  // Search group
  //
  N.wire.before(apiPath, async function usergroup_search(env) {

    env.data.userGroup = await UserGroup.findById(env.params._id);

    if (!env.data.userGroup) {
      throw {
        code: N.io.BAD_REQUEST,
        message: env.t('error_not_exists')
      };
    }
  });


  // Check circular dependency & update groups
  //
  N.wire.on(apiPath, async function usergroup_update(env) {
    let group = env.data.userGroup;

    let circularGroup = await detectCircular(N, group._id, env.params.parent_group);

    if (circularGroup) {
      throw {
        code: N.io.BAD_REQUEST,
        message: env.t('error_circular_dependency')
      };
    }

    group.short_name   = env.params.short_name;
    group.parent_group = env.params.parent_group;

    await group.save();

    // Recalculate store settings of all groups.
    let store = N.settings.getStore('usergroup');

    if (!store) throw 'Settings store `usergroup` is not registered.';

    await store.set(env.params.settings, { usergroup_id: group._id });
  });
};
