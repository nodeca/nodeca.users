// Register 'usergroups' special setting values fetcher.
// Allows to use `values: usergroups` in setting definitions.


'use strict';


var _       = require('lodash');
var thenify = require('thenify');


module.exports = function (N) {

  N.wire.before('init:settings', function settings_usergroups_fetcher_setup() {

    N.settings.customizers.usergroups = thenify.withCallback(function fetch_usergroups(callback) {
      N.models.users.UserGroup
          .find()
          .select('_id short_name')
          .sort('_id')
          .lean(true)
          .exec(function (err, groups) {

        callback(err, _.map(groups, function (group) {
          return {
            name:  group.short_name,
            value: group._id,
            title: 'admin.users.usergroup_names.' + group.short_name
          };
        }));
      });
    });

  });
};
