// Try ty fetch user by `env.params.user_hid`
//
// - terminates with 404 if not exists
// - terminates with 404 if user marked as deleted & no permissions
//
'use strict';


module.exports = function (N, apiPath) {
  var User = N.models.users.User;

  // Fetch permission to see deleted users
  //
  N.wire.before(apiPath, function* fetch_can_see_deleted_users(env) {
    let can_see_deleted_users = yield env.extras.settings.fetch('can_see_deleted_users');

    env.data.settings = env.data.settings || {};
    env.data.settings.can_see_deleted_users = can_see_deleted_users;
  });


  // Fetch user by hid
  //
  N.wire.on(apiPath, function fetch_user_by_hid(env, callback) {
    // This method can be called multiple times (from page & subcalls).
    // Check if data already loaded.
    if (env.data.user) { return callback(); }

    var query = User.findOne({ hid: env.params.user_hid }).lean(true);

    // Check 'can_see_deleted_users' permission
    if (!env.data.settings.can_see_deleted_users) {
      query.where({ exists: true });
    }

    query.exec(function (err, user) {
      if (err) {
        callback(err);
        return;
      }

      if (!user) {
        callback(N.io.NOT_FOUND);
        return;
      }

      env.data.user = user;

      callback();
    });
  });
};
