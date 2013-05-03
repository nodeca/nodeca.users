'use strict';


var _ = require('lodash');
var fetchGroups = require('./_lib/fetch_groups');


module.exports = function (N, apiPath) {
  var UserGroup = N.models.users.UserGroup;


  N.validate(apiPath, {
    _id: {
      type: 'string'
    , required: true
    , minLength: 24
    , maxLength: 24
    }
  });


  N.wire.on(apiPath, function (env, callback) {
    var data = env.response.data;

    data.setting_schemas = N.config.setting_schemas['usergroup'] || {};

    UserGroup
        .findById(env.params._id)
        .select('_id short_name')
        .setOptions({ lean: true })
        .exec(function (err, currentGroup) {

      if (err) {
        callback(err);
        return;
      }

      if (!currentGroup) {
        callback(N.io.NOT_FOUND);
        return;
      }

      data.head.title =
        env.helpers.t('admin.users.usergroups.edit.title', {
          name: currentGroup.short_name
        });

      data.current_group_id = currentGroup._id;

      fetchGroups(N, _.keys(data.setting_schemas), function (err, allGroupsData) {
        data.groups_data = allGroupsData;
        callback(err);
      });
    });
  });
};
