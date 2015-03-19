// Save settings for specified group

'use strict';


var _ = require('lodash');

var detectCircular      = require('./_lib/detect_circular');
var PARAMS_SCHEMA       = require('./_lib/params_schema');


module.exports = function (N, apiPath) {
  var UserGroup = N.models.users.UserGroup;


  N.validate(apiPath, _.assign({
    _id: { format: 'mongo', required: true }
  }, PARAMS_SCHEMA));


  // If parent specified, check it's existance
  //
  N.wire.before(apiPath, function usergroup_check_parent(env, callback) {
    if (!env.params.parent_group) {
      callback(); // This is a root group.
      return;
    }

    UserGroup.count({ _id: env.params.parent_group }, function (err, count) {
      if (err) {
        callback(err);
        return;
      }

      if (count === 0) {
        callback({
          code: N.io.BAD_REQUEST
        , message: env.t('error_nonexistent_parent_group')
        });
      }

      callback(); // Ok.
    });
  });


  // Search group
  //
  N.wire.before(apiPath, function usergroup_search(env, callback) {

    UserGroup.findById(env.params._id).exec(function(err, group) {

      if (err) {
        callback(err);
        return;
      }

      if (!group) {
        callback({
          code: N.io.BAD_REQUEST
        , message: env.t('error_not_exists')
        });
        return;
      }

      env.data.userGroup = group;

      callback();
    });
  });


  // Check circular dependency & update groups
  //
  N.wire.on(apiPath, function usergroup_update(env, callback) {
    var group = env.data.userGroup;

    detectCircular(N, group._id, env.params.parent_group, function (err, circularGroup) {
      if (err) {
        callback(err);
        return;
      }

      if (circularGroup) {
        callback({
          code: N.io.BAD_REQUEST
        , message: env.t('error_circular_dependency')
        });
        return;
      }

      group.short_name   = env.params.short_name;
      group.parent_group = env.params.parent_group;

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
