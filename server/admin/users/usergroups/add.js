// Display add group form
//
"use strict";


var _ = require('lodash');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
  });

  // Request handler
  //
  N.wire.on(apiPath, function (env, callback) {
    var UserGroup = N.models.users.UserGroup;

    env.data.settings_categories = N.settings.getStore('usergroup').getCategories();

    // collect existing usergroups for `parent group` select
    env.data.usergroups = [];
    UserGroup.find().select({ '_id':1, 'short_name': 1 })
        .setOptions({ lean: true }).exec(function(err, usergroups) {
      if (err) {
        callback(err);
        return;
      }
      usergroups.forEach(function(group) {
          group._id = group._id.toString();
          env.data.usergroups.push(group);
        });
      callback();
    });
  });


  // Put usergroups items into response data
  //
  N.wire.after(apiPath, function _copy_data(env, callback) {
    env.response.data.settings_categories = env.data.settings_categories;
    env.response.data.usergroups = env.data.usergroups;
    callback();
  });


  //
  // Fill head meta
  //
  N.wire.after(apiPath, function _add_meta(env, callback) {
    env.response.data.head.title = env.helpers.t('admin.users.usergroups.add.title');
    callback();
  });
};
