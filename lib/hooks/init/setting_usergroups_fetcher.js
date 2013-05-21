// Register 'usergroups' special setting values fetcher.
// Allows to use `values: usergroups` in setting definitions.


'use strict';


var _ = require('lodash');


module.exports = function (N) {
  N.wire.before('init:settings', function (sandbox) {
    sandbox.selectionListFetchers['usergroups'] = function fetchUserGroups(env, callback) {
      N.models.users.UserGroup
          .find()
          .select('_id short_name')
          .sort('_id')
          .setOptions({ lean: true })
          .exec(function (err, groups) {

        callback(err, _.map(groups, function (group) {
          var translation = 'admin.users.usergroup_names.' + group.short_name;

          return {
            name:  group.short_name
          , value: group._id
          , title: env && env.helpers.t.exists(translation) ?
                   env.helpers.t(translation)        :
                   group.short_name
          };
        }));
      });
    };
  });
};
