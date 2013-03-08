// Display user groups list
//
"use strict";


var async = require('async');


var group_in_fields = [
  '_id',
  'short_name',
  'is_protected'
];


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
  });

  // Request handler
  //
  N.wire.on(apiPath, function (env, callback) {
    var UserGroup = N.models.users.UserGroup;
    var User      = N.models.users.User;

    env.data.usergroups = {};
    UserGroup.find().select(group_in_fields.join(' ')).sort('_id')
        .setOptions({ lean: true }).exec(function(err, usergroups) {
      if (err) {
        callback(err);
        return;
      }
      async.forEachSeries(usergroups, function(group, next_group) {
        User.count({ usergroups: group._id }, function(err, count) {
          group.user_number = count;
          group._id = group._id.toString();
          env.data.usergroups[group['short_name']] = group;

          next_group();
        });
      }, callback);
    });
  });


  // Put usergroups into response data
  //
  N.wire.after(apiPath, function _copy_data(env) {
    env.response.data.usergroups = env.data.usergroups;
  });


  // Fill head meta
  //
  N.wire.after(apiPath, function _add_meta(env) {
    env.response.data.head.title = env.helpers.t(env.method + '.title');
  });
};
