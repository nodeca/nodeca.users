'use strict';


var _     = require('lodash');
var async = require('async');


module.exports = function (N, fetchSettings, callback) {
  var UserGroup = N.models.users.UserGroup
    , store     = N.settings.getStore('usergroup');

  UserGroup
      .find()
      .select('_id short_name is_protected parent_group overriden_settings forced_settings')
      .sort('is_protected _id')
      .setOptions({ lean: true })
      .exec(function (err, allGroupsData) {

    if (err) {
      callback(err);
      return;
    }

    async.forEach(allGroupsData, function (group, next) {
      group.setting_values = {};

      store.get(fetchSettings, { usergroup_ids: [group._id] }, function (err, results) {
        if (err) {
          next({ code: N.io.BAD_REQUEST, message: err });
          return;
        }

        _.forEach(results, function (setting, key) {
          group.setting_values[key] = setting.value;
        });

        next();
      });
    }, function (err) {
      if (err) {
        callback(err);
        return;
      }
      callback(null, allGroupsData);
    });
  });
};
