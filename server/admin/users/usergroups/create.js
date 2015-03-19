// Create user group

'use strict';


var PARAMS_SCHEMA       = require('./_lib/params_schema');


module.exports = function (N, apiPath) {
  var UserGroup = N.models.users.UserGroup;


  N.validate(apiPath, PARAMS_SCHEMA);


  // Check if parent_group exists or is root.
  //
  N.wire.before(apiPath, function check_usergroup_parent_ok(env, callback) {
    if (!env.params.parent_group) {
      callback(); // This is a root group.
      return;
    }

    UserGroup.count({ _id: env.params.parent_group }, function (err, count) {
      if (err) {
        callback(err);
        return;
      }

      if (0 === count) {
        callback({
          code: N.io.BAD_REQUEST
        , message: env.t('error_nonexistent_parent_group')
        });
      }

      callback(); // Ok.
    });
  });


  N.wire.on(apiPath, function usergroup_create(env, callback) {

    // Check if any group with the specified name exists.
    UserGroup.count({ short_name: env.params.short_name }).exec(function (err, count) {
      if (err) {
        callback(err);
        return;
      }

      if (0 !== count) {
        callback({
          code: N.io.BAD_REQUEST
        , message: env.t('error_short_name_busy')
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
        short_name:   env.params.short_name,
        parent_group: env.params.parent_group
      });

      group.save(function (err) {
        if (err) {
          callback(err);
          return;
        }

        // Recalculate store settings of all groups.
        var store = N.settings.getStore('usergroup');

        if (!store) {
          callback('Settings store `usergroup` is not registered.');
          return;
        }

        store.set(env.params.settings, { usergroup_id: group._id }, function(err) {
          if (err) {
            callback(err);
            return;
          }

          store.updateInherited(callback);
        });
      });
    });
  });
};
