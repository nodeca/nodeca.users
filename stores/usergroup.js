'use strict';


const _        = require('lodash');
const co       = require('co');
const memoizee = require('memoizee');
const thenify  = require('thenify');


module.exports = function (N) {

  // Helper to fetch usergroups by IDs
  //
  function fetchUsrGrpSettings(ids, callback) {
    N.models.users.UserGroup
      .find({ _id: { $in: ids } })
      .select('settings')
      .lean(true)
      .exec(callback);
  }

  // Memoized version of fetchUserGroups helper
  //
  var fetchUsrGrpSettingsCached = memoizee(fetchUsrGrpSettings, {
    // Memoizee options. Revalidate cache after each 60 sec.
    async:     true,
    maxAge:    60000,
    primitive: true
  });


  // ##### Params
  //
  // - usergroup_ids (Array)
  //
  var UsergroupStore = N.settings.createStore({
    get: thenify.withCallback(function (keys, params, options, callback) {
      var self  = this,
          fetch = options.skipCache ? fetchUsrGrpSettings : fetchUsrGrpSettingsCached;

      if (!_.isArray(params.usergroup_ids) || _.isEmpty(params.usergroup_ids)) {
        callback('usergroup_ids param required to be non-empty array for getting settings from usergroup store');
        return;
      }

      fetch(params.usergroup_ids.sort(), function (err, groups) {
        var results = {};

        if (err) {
          callback(err);
          return;
        }

        keys.forEach(function (key) {
          var values = [];

          groups.forEach(function (group) {
            if (group.settings && group.settings[key]) {
              values.push(group.settings[key]);
            } else {
              values.push({
                value: self.getDefaultValue(key),
                force: false // Default value SHOULD NOT be forced.
              });
            }
          });

          // Get merged value.
          results[key] = N.settings.mergeValues(values);
        });

        callback(null, results);
      });
    }),

    // ##### Params
    //
    // - usergroup_id (String|ObjectId)
    //
    set: thenify.withCallback(function (settings, params, callback) {
      if (!params.usergroup_id) {
        callback('usergroup_id param is required for saving settings into usergroup store');
        return;
      }

      N.models.users.UserGroup
          .findOne({ _id: params.usergroup_id })
          .exec(function (err, group) {

        if (err) {
          callback(err);
          return;
        }

        // Make sure we have settings storages.
        group.settings = group.settings || {};

        Object.keys(settings).forEach(function (key) {
          var setting = settings[key];

          if (setting === null) {
            delete group.settings[key];
          } else {
            group.settings[key] = {
              value: setting.value,
              force: setting.force,
              own:   true
            };
          }
        });

        group.markModified('settings');
        group.save(callback);
      });
    })
  });

  // Walk through all existent usergroups and recalculate their permissions
  //
  UsergroupStore.updateInherited = co.wrap(function* updateInherited() {
    let self = this;
    let groups = yield N.models.users.UserGroup.find().select('_id parent_group settings');


    // Get group from groups array by its id
    //
    function getGroupById(id) {
      return groups.filter(
        // Universal way for equal check on: Null, ObjectId, and String.
        g => String(g._id) === String(id)
      )[0];
    }


    // Find first own setting for group.
    //
    function findInheritedSetting(groupId, settingName) {
      if (!groupId) {
        return null;
      }

      let group = getGroupById(groupId);

      // Setting exists, and it is not inherited from another section.
      if (group &&
        group.settings &&
        group.settings[settingName] &&
        group.settings[settingName].own) {
        return group.settings[settingName];
      }

      // Recursively walk through ancestors sequence.
      if (group.parent_group) {
        return findInheritedSetting(group.parent_group, settingName);
      }

      return null;
    }

    // Get full settings list for specified group
    // For inherited settings automatically extract values from parents
    //
    function fetchSettings(groupId) {
      let group = getGroupById(groupId);
      let result = {};

      self.keys.forEach(settingName => {
        // Do not touch own settings. We only update inherited settings.
        if (group.settings[settingName] &&
          group.settings[settingName].own) {
          return;
        }

        let setting = findInheritedSetting(group.parent_group, settingName);

        if (setting) {
          // Set/update inherited setting.
          group.settings[settingName] = {
            value: setting.value,
            force: setting.force,
            own:   false
          };
        } else {
          // Drop deprecated inherited setting.
          delete group.settings[settingName];
        }
      });

      return result;
    }

    yield groups.map(group => this.set(fetchSettings(group.id), { usergroup_id: group._id }));
  });


  return UsergroupStore;
};
