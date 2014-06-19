// Show existing groups list

'use strict';


var async = require('async');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});


  N.wire.on(apiPath, function (env, callback) {
    var res = env.res;

    res.head.title = env.t('title');
    res.usergroups = [];

    N.models.users.UserGroup
        .find()
        .select('_id short_name is_protected')
        .sort('_id')
        .lean(true)
        .exec(function (err, usergroups) {

      if (err) {
        callback(err);
        return;
      }

      res.usergroups = usergroups;
      callback();
    });
  });


  N.wire.after(apiPath, function (env, callback) {
    var res = env.res;

    res.members_count = {};

    async.each(res.usergroups, function (group, next) {
      N.models.users.User.count({ usergroups: group._id }, function (err, members_count) {
        if (err) { return next(err); }

        res.members_count[group._id] = members_count;
        next();
      });
    }, callback);
  });
};
