'use strict';


var _ = require('lodash');

var updateSettings = require('./_lib/update_settings');
var PARAMS_SCHEMA  = require('./_lib/params_schema');


module.exports = function (N, apiPath) {
  var UserGroup = N.models.users.UserGroup;


  N.validate(apiPath, PARAMS_SCHEMA);


  N.wire.on(apiPath, function (env, callback) {
    UserGroup.count({ short_name: env.params.short_name }).exec(function (err, existent) {
      if (err) {
        callback(err);
        return;
      }

      if (existent) {
        callback({
          code: N.io.BAD_REQUEST
        , message: env.helpers.t('admin.users.usergroups.create.error.short_name_busy')
        });
        return;
      }

      var group = new UserGroup(_.pick(env.params, 'short_name', 'parent_group'));

      group.raw_settings.usergroup = {};

      _.forEach(env.params.raw_settings, function (setting, key) {
        group.raw_settings.usergroup[key] = setting;
      });

      group.save(function (err) {
        if (err) {
          callback(err);
          return;
        }

        updateSettings(N, callback);
      });
    });
  });
};
