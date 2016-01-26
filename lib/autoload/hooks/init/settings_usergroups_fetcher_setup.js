// Register 'usergroups' special setting values fetcher.
// Allows to use `values: usergroups` in setting definitions.


'use strict';


module.exports = function (N) {

  N.wire.before('init:settings', function settings_usergroups_fetcher_setup() {

    N.settings.customizers.usergroups = function fetch_usergroups() {
      return N.models.users.UserGroup
        .find()
        .select('_id short_name')
        .sort('_id')
        .lean(true)
        .then(groups => groups.map(group => ({
          name:  group.short_name,
          value: group._id,
          title: 'admin.users.usergroup_names.' + group.short_name
        })));
    };
  });
};
