'use strict';


var _     = require('lodash');
var async = require('async');


module.exports = function (N, apiPath) {
  var UserGroup = N.models.users.UserGroup
    , store     = N.settings.getStore('usergroup');


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

    data.currentGroupId = null;
    data.allGroupsData  = [];
    data.settingSchemas = N.config.setting_schemas['usergroup'] || {};

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

      data.currentGroupId = currentGroup._id;

      UserGroup
          .find()
          .select('_id short_name is_protected parent_group overriden_settings forced_settings')
          .sort('is_protected _id')
          .setOptions({ lean: true })
          .exec(function (err, allGroupsData) {

        data.allGroupsData = allGroupsData;

        async.forEach(allGroupsData, function (group, next) {
          group.setting_values = {};

          store.get(_.keys(data.settingSchemas), { usergroup_ids: [group._id] }, function (err, results) {
            if (err) {
              next({ code: N.io.BAD_REQUEST, message: err });
              return;
            }

            _.forEach(results, function (setting, key) {
              group.setting_values[key] = setting.value;
            });

            next();
          });
        }, callback);
      });
    });
  });
};
