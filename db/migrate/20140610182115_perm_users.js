'use strict';

var async   = require('async');
var thenify = require('thenify');

module.exports.up = thenify(function (N, cb) {
  var models = N.models;

  var usergroupStore = N.settings.getStore('usergroup');

  async.series([
    // add usergroup settings for administrators, members
    function (callback) {
      models.users.UserGroup.find({ short_name: { $in: [ 'administrators', 'members' ] } })
        .exec(function (err, groups) {

          if (err) {
            callback(err);
            return;
          }

          async.each(groups, function (group, next) {
            usergroupStore.set({
              users_can_upload_media: { value: true }
            }, { usergroup_id: group._id }, next);
          }, callback);
        });
    },

    // Recalculate store settings of all groups.
    function (callback) {
      usergroupStore.updateInherited(callback);
    }
  ], cb);
});
