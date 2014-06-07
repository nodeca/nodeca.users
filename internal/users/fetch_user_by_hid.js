// Try ty fetch user by `env.params.user_hid`
//
// - terminates with 404 if not exists
// - terminates with 404 if user marked as deleted & no permissions
//
'use strict';


module.exports = function (N, apiPath) {
  var User = N.models.users.User;

  N.wire.on(apiPath, function (env, callback) {
    // This method can be called multiple times (from page & subcalls).
    // Check if data already loaded.
    if (env.data.user) { return callback(); }

    User
      .findOne({ 'hid': env.params.user_hid })
      .lean(true)
      .exec(function (err, user) {
        if (err) {
          callback(err);
          return;
        }

        // TODO: add permissions to view deleted users
        if (!user || !user.exists) {
          callback(N.io.NOT_FOUND);
          return;
        }

        env.data.user = user;
        callback();
      });
  });
};
