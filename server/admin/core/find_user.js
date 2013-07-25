// Find users by part of name.


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    search: { type: 'string', required: true, minLength: 2 }
  });

  N.wire.on(apiPath, function moderator_find_user(env, callback) {
    N.models.users.User
        .find().where('_uname').regex(new RegExp(env.params.search, 'mi'))
        .limit(10)
        .select('_id _uname')
        .setOptions({ lean: true })
        .exec(function (err, users) {

      if (err) {
        callback(err);
        return;
      }

      env.response.data.users = users;
      callback();
    });
  });
};
