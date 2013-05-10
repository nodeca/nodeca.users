// Create user group

'use strict';


var updateStoreSettings = require('./_lib/update_store_settings');
var PARAMS_SCHEMA       = require('./_lib/params_schema');


module.exports = function (N, apiPath) {
  var UserGroup = N.models.users.UserGroup;


  N.validate(apiPath, PARAMS_SCHEMA);


  N.wire.on(apiPath, function (env, callback) {

    // Check if any group with the specified name exists.
    UserGroup.count({ short_name: env.params.short_name }).exec(function (err, count) {
      if (err) {
        callback(err);
        return;
      }

      if (0 !== count) {
        callback({
          code: N.io.BAD_REQUEST
        , message: env.helpers.t('admin.users.usergroups.create.error_short_name_busy')
        });
        return;
      }

      // Raw settings contains interface state:
      // - Full settings list for Root groups
      // - List of overriden settings for inherited groups
      //
      // We store interface data separately, and then use it
      // to calculate final `store` values (permissions)
      //
      // See ./_lib/params_schema.js for details on raw settings format.
      var group = new UserGroup({
        short_name:   env.params.short_name
      , parent_group: env.params.parent_group
      , raw_settings: env.params.raw_settings
      });

      group.save(function (err) {
        if (err) {
          callback(err);
          return;
        }

        // Recalculate store settings of all groups.
        updateStoreSettings(N, callback);
      });
    });
  });
};
