// Show existing groups lit

'use strict';


var async = require('async');


var USERGROUP_FIELDS = {
  _id: 1
, short_name: 1
, is_protected: 1
};


module.exports = function (N, apiPath) {
  var UserGroup = N.models.users.UserGroup;
  var User      = N.models.users.User;


  N.validate(apiPath, {});


  N.wire.on(apiPath, function (env, callback) {
    var data = env.response.data;

    data.head.title =
      env.helpers.t('admin.users.usergroups.show.title');

    data.usergroups = [];

    UserGroup.find()
        .select(USERGROUP_FIELDS)
        .sort('is_protected _id')
        .setOptions({ lean: true })
        .exec(function (err, usergroups) {

      if (err) {
        callback(err);
        return;
      }

      data.usergroups = usergroups;

      async.forEach(usergroups, function (group, next) {
        User.count({ usergroups: group._id }, function (err, members_count) {
          group.members_count = members_count;
          next();
        });
      }, callback);
    });
  });
};
