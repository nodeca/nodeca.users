// Save settings for specified group

'use strict';


var _ = require('lodash');

var detectCircular      = require('./_lib/detect_circular');
var updateStoreSettings = require('./_lib/update_store_settings');
var PARAMS_SCHEMA       = require('./_lib/params_schema');


module.exports = function (N, apiPath) {
  var UserGroup = N.models.users.UserGroup;


  N.validate(apiPath, _.extend({
    _id: {
      type: 'string'
    , required: true
    }
  }, PARAMS_SCHEMA));


  // Check do wanted parent_group exists or not.
  N.wire.before(apiPath, function (env, callback) {
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
          code: N.io.CLIENT_ERROR
        , message: env.helpers.t('admin.users.usergroups.update.error_nonexistent_parent_group')
        });
      }

      callback(); // Ok.
    });
  });


  N.wire.on(apiPath, function (env, callback) {
    UserGroup.findById(env.params._id).exec(function (err, group) {
      if (err) {
        callback(err);
        return;
      }

      if (!group) {
        callback(N.io.NOT_FOUND);
        return;
      }

      detectCircular(group._id, env.params.parent_group, function (err, circularGroup) {
        if (err) {
          callback(err);
          return;
        }

        if (circularGroup) {
          callback({
            code: N.io.CLIENT_ERROR
          , message: env.helpers.t('admin.users.usergroups.update.error_circular_dependency')
          });
          return;
        }

        group.short_name   = env.params.short_name;
        group.parent_group = env.params.parent_group;

        // Raw settings contains interface state:
        // - Full settings list for Root groups
        // - List of overriden settings for inherited groups
        //
        // We store interface data separately, and then use it
        // to calculate final `store` values (permissions)
        //
        // See ./_lib/params_schema.js for details on raw settings format.
        group.raw_settings = env.params.raw_settings;
        group.markModified('raw_settings');

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
  });
};
