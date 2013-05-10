// Show existing groups list

'use strict';


var async = require('async');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});


  N.wire.on(apiPath, function (env, callback) {
    var data = env.response.data;

    data.head.title =
      env.helpers.t('admin.users.usergroups.index.title');

    data.usergroups = [];

    N.models.users.UserGroup
        .find()
        .select('_id short_name is_protected')
        .sort('is_protected _id')
        .setOptions({ lean: true })
        .exec(function (err, usergroups) {

      if (err) {
        callback(err);
        return;
      }

      data.usergroups = usergroups;
      callback();
    });
  });


  N.wire.after(apiPath, function (env, callback) {
    var data = env.response.data;

    data.members_count = {};

    async.forEach(data.usergroups, function (group, next) {
      N.models.users.User.count({ usergroups: group._id }, function (err, members_count) {
        data.members_count[group._id] = members_count;
        next();
      });
    }, callback);
  });
};
