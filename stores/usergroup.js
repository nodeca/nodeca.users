'use strict';


var _        = require('lodash');
var memoizee = require('memoizee');


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
    async:     true
  , maxAge:    60000
  , primitive: true
  });


  // ##### Params
  //
  // - usergroup_ids (Array)
  //
  var UsergroupStore = N.settings.createStore({
    get: function (keys, params, options, callback) {
      var self  = this
        , fetch = options.skipCache ? fetchUsrGrpSettings : fetchUsrGrpSettingsCached;

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
                value: self.getDefaultValue(key)
              , force: false // Default value SHOULD NOT be forced.
              });
            }
          });

          // Get merged value.
          results[key] = N.settings.mergeValues(values);
        });

        callback(null, results);
      });
    }
    // ##### Params
    //
    // - usergroup_id (String|ObjectId)
    //
  , set: function (settings, params, callback) {
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

        _.forEach(settings, function (options, key) {
          if (null === options) {
            delete group.settings[key];
          } else {
            group.settings[key] = options;
          }
        });

        group.markModified('settings');
        group.save(callback);
      });
    }
  });

  return UsergroupStore;
};
