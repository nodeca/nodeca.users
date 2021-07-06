'use strict';


const _        = require('lodash');
const memoize  = require('promise-memoize');


module.exports = function (N) {

  // Helper to fetch all usergroups
  //
  function fetchUsrGrpSettings() {
    return N.models.users.UserGroup
      .find()
      .select('parent_group settings')
      .lean(true)
      .exec();
  }

  // Memoized version of fetchUserGroups helper
  //
  let fetchUsrGrpSettingsCached = memoize(fetchUsrGrpSettings, { maxAge: 60000 });


  // Find first own setting for group.
  //
  function findInheritedSetting(groupId, settingName, groupsById) {
    if (!groupId) return null;

    let group = groupsById[groupId];

    // Setting exists, and it is not inherited from another section.
    if (group?.settings?.[settingName]) {
      return group.settings[settingName];
    }

    // Recursively walk through ancestors sequence.
    if (group.parent_group) {
      return findInheritedSetting(group.parent_group, settingName, groupsById);
    }

    return null;
  }


  // ##### Params
  //
  // - usergroup_ids (Array)
  //
  let UsergroupStore = N.settings.createStore({
    async get(keys, params, options) {
      let fetch = options.skipCache ? fetchUsrGrpSettings : fetchUsrGrpSettingsCached;

      if (!Array.isArray(params.usergroup_ids) || params.usergroup_ids.length === 0) {
        throw 'usergroup_ids param required to be non-empty array ' +
              'for getting settings from usergroup store';
      }

      let groups_by_id = _.keyBy(await fetch(), '_id');
      let groups = params.usergroup_ids.map(id => groups_by_id[id]).filter(Boolean);

      let results = {};

      for (let key of keys) {
        let values = [];

        for (let group of groups) {
          if (group.settings?.[key]) {
            values.push(group.settings[key]);
            continue;
          }

          let setting = findInheritedSetting(group.parent_group, key, groups_by_id);

          if (setting) {
            values.push(setting);
            continue;
          }

          values.push({
            value: this.getDefaultValue(key),
            force: false // Default value SHOULD NOT be forced.
          });
        }

        // Get merged value.
        results[key] = N.settings.mergeValues(values);
      }

      return results;
    },

    // ##### Params
    //
    // - usergroup_id (String|ObjectId)
    //
    set(settings, params) {
      if (!params.usergroup_id) {
        return Promise.reject('usergroup_id param is required for saving settings into usergroup store');
      }

      return N.models.users.UserGroup.findOne({ _id: params.usergroup_id }).then(group => {
        // Make sure we have settings storages.
        group.settings = group.settings || {};

        Object.keys(settings).forEach(key => {
          let setting = settings[key];

          if (setting === null) {
            delete group.settings[key];
          } else {
            group.settings[key] = {
              value: setting.value,
              force: setting.force
            };
          }
        });

        group.markModified('settings');
        return group.save();
      });
    }
  });


  return UsergroupStore;
};
