'use strict';

var async = require('async');

module.exports.up = function (N, cb) {
  var models = N.models;

  var usergroupStore = N.settings.getStore('usergroup');

  async.series([
    // add usergroup settings for admin
    function (callback) {
      models.users.UserGroup.findOne({ short_name: 'administrators' })
        .exec(function (err, group) {

          if (err) {
            callback(err);
            return;
          }

          usergroupStore.set({
            can_access_acp: { value: true },
            can_see_hellbanned: { value: true },
            can_see_deleted_users: { value: true },
            can_see_ip: { value: true }
          }, { usergroup_id: group._id }, callback);
        });
    },

    // Recalculate store settings of all groups.
    function (callback) {
      usergroupStore.updateInherited(callback);
    }
  ], cb);
};
