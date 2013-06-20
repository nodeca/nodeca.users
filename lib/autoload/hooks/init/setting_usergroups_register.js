// Register 'usergroups' special setting values fetcher.
// Allows to use `values: usergroups` in setting definitions.


'use strict';


var _ = require('lodash');


module.exports = function (N) {

  N.wire.before('init:__settings', function setting_usergroups_register(sandbox) {

    sandbox.selectionListFetchers['usergroups'] = function fetchUserGroups(callback) {
      N.models.users.UserGroup
          .find()
          .select('_id short_name')
          .sort('_id')
          .setOptions({ lean: true })
          .exec(function (err, groups) {

        callback(err, _.map(groups, function (group) {
          return {
            name:  group.short_name
          , value: group._id
          , title: 'admin.users.usergroup_names.' + group.short_name
          };
        }));
      });
    };

  });
};
