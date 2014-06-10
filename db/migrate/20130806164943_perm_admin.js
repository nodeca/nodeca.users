'use strict';

var _     = require('lodash');
var async = require('async');
var updateStoreSettings = require('../../server/admin/users/usergroups/_lib/update_store_settings');

module.exports.up = function (N, cb) {
  var models = N.models;

  async.series([
    //add usergroup settings for admin
    function (callback) {
      models.users.UserGroup.findOne({ short_name: 'administrators' })
        .exec(function (err, group) {

          if (err) {
            callback(err);
            return;
          }

          group.raw_settings = _.extend({}, group.raw_settings, {
            can_access_acp: { value: true },
            can_see_hellbanned: { value: true },
            can_see_deleted_users: { value: true }
          });
          group.save(callback);
        });
    },

    // Recalculate store settings of all groups.
    function (callback) {
      updateStoreSettings(N, callback);
    }
  ], cb);
};