// Display usergroup
//

"use strict";


var _ = require('lodash');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    _id: {
      type: 'string',
      required: true,
      minLength: 24,
      maxLength: 24
    }
  });

  // Request handler
  //
  N.wire.on(apiPath, function (env, callback) {
    var UserGroup = N.models.users.UserGroup;

    env.data.usergroups = [];

    UserGroup.findById(env.params._id)
        .setOptions({ lean: true }).exec(function(err, group) {
      if (err) {
        callback(err);
        return;
      }
      if (!group) {
        callback(N.io.NOT_FOUND);
        return;
      }

      // FIXME fetch settings from store
      var settings = N.config.setting_schemas['usergroup'];

      // collect  usergroups items and group it by setting group
      var settings_categories = {};
      _.keys(settings).forEach(function(name) {
        var item = settings[name];

        // mark setting as overriden
        if (group.raw_settings && name in group.raw_settings) {
          item.value = group.raw_settings[name];
          item.overriden = true;
        }

        var category_name = item['category'];
        if (!settings_categories[category_name]) {
          settings_categories[category_name] = {};
        }
        settings_categories[category_name][name] = item;
      });
      env.data.settings_categories = settings_categories;

      group._id = group._id.toString();
      env.data.current = group;

      // fetch other groups need for parent selected
      UserGroup.find().select({ '_id':1, 'short_name': 1 })
          .setOptions({ lean: true }).exec(function(err, usergroups) {
        usergroups.forEach(function(group) {
          group._id = group._id.toString();
          // group can't be parent of him self
          if (group._id === env.data.current._id) {
            return;
          }
          env.data.usergroups.push(group);
        });
        callback();
      });
    });
  });


  // Put currents items into response data
  //
  N.wire.after(apiPath, function _copy_data(env) {
    env.response.data.current = env.data.current;
    env.response.data.usergroups = env.data.usergroups;
    env.response.data.settings_categories = env.data.settings_categories;
  });


  // Fill head meta
  //
  N.wire.after(apiPath, function _add_meta(env) {
    env.response.data.head.title = env.helpers.t(
      'admin.users.usergroups.title.edit',
      { name: env.data.current.short_name }
    );
  });
};
