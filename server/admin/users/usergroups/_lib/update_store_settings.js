// Walks through all existent usergroups and recalculates their
// interface state (raw_settings) into `usergroup store` values (permissions)
//


'use strict';


var _     = require('lodash');
var async = require('async');


module.exports = function updateStoreSettings(N, callback) {
  var store = N.settings.getStore('usergroup');

  N.models.users.UserGroup
      .find()
      .select('_id parent_group raw_settings')
      .setOptions({ lean: true })
      .exec(function (err, groups) {

    if (err) {
      callback(err);
      return;
    }

    // Get full settings list for specified group
    // For inherited settings automatically extract values from parents
    function fetchSettings(groupId) {
      var group  = _.find(groups, function (g) { return g._id.equals(groupId); })
        , result = {};

      // If parent group exists - fetch it's settings values first
      if (group.parent_group) {
        result = _.clone(fetchSettings(group.parent_group), true);
      }

      // Now override defaults with value of current group
      // (root one will have full list)
      if (group.raw_settings && group.raw_settings.usergroup) {
        _.extend(result, group.raw_settings.usergroup);
      }

      return result;
    }

    async.forEach(groups, function (group, next) {
      store.set(fetchSettings(group._id), { usergroup_id: group._id }, next);
    }, callback);
  });
};
