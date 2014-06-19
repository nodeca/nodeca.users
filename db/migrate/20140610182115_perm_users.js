'use strict';

var _     = require('lodash');
var async = require('async');
var updateStoreSettings = require('../../server/admin/users/usergroups/_lib/update_store_settings');

module.exports.up = function (N, cb) {
  var models = N.models;

  async.series([
    //add usergroup settings for administrators, members
    function (callback) {
      models.users.UserGroup.find({ short_name: { $in: ['administrators', 'members'] } })
        .exec(function (err, groups) {

          if (err) {
            callback(err);
            return;
          }

          async.each(groups, function (group, next) {
            group.raw_settings = _.assign({}, group.raw_settings, {
              users_can_upload_media: { value: true }
            });
            group.save(next);
          }, callback);
        });
    },

    // Recalculate store settings of all groups.
    function (callback) {
      updateStoreSettings(N, callback);
    }
  ], cb);
};
