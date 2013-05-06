// Walks through all existent usergroups and recalculates their settings to
// comform the group inheritance.
//


'use strict';


var _     = require('lodash');
var async = require('async');


module.exports = function updateSettings(N, callback) {
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

    function fetchSettings(groupId) {
      var group  = _.find(groups, function (g) { return g._id.equals(groupId); })
        , result = {};

      if (!group) {
        return result;
      }

      if (group.parent_group) {
        _.extend(result, fetchSettings(group.parent_group));
      }

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
