// Inject info about users to env (~ manual join)
//
'use strict';


var _ = require('lodash');


var user_fields = [
  '_id',
  'hid',
  'name',
  'nick',
  'avatar_id',
  'avatar_fallback'
];

module.exports = function (N) {


  // Fetch permission to see deleted users
  //
  N.wire.after('server_chain:*', { priority: 50 }, function fetch_can_see_deleted_users(env, callback) {
    env.extras.settings.fetch('can_see_deleted_users', function (err, can_see_deleted_users) {
      if (err) {
        callback(err);
        return;
      }

      env.data.settings = env.data.settings || {};
      env.data.settings.can_see_deleted_users = can_see_deleted_users;
      callback();
    });
  });


  // fetch and prepare users info
  // fired after each controllers
  // list of user id should be prepared in controller
  N.wire.after('server_chain:*', { priority: 50 }, function users_join(env, callback) {

    if (!_.isArray(env.data.users) || !env.data.users.length) {
      callback();
      return;
    }

    // There can be some garbage:
    // - empty ids (just because we push data without checks)
    // - duplicated ids(the same users from different objects)
    //
    // We remove dummy elements, but let mongo filter unique values,
    // because it's more fast.
    var user_ids = _.compact(env.data.users);

    env.extras.puncher.start('users join', { count: user_ids.length });

    env.res.users = env.res.users || {};

    // uncomment to imitate empty users (to check template & speed)
    //    env.extras.puncher.stop();
    //    return callback();

    var query = N.models.users.User
      .where('_id').in(user_ids)
      .select(user_fields.join(' '))
      .lean(true);

    // Check 'can_see_deleted_users' permission
    if (!env.data.settings.can_see_deleted_users) {
      query.where({ 'exists': true });
    }

    query.exec(function (err, user_list) {

      if (err) {
        callback(err);
        return;
      }

      user_list.forEach(function (user) {
        user.avatar_id = user.avatar_id || user.avatar_fallback;

        // only registered users can see full name and avatar
        if (!env.runtime.is_member) {
          user.name = user.nick;
          user.avatar_id = user.avatar_fallback;
        }

        env.res.users[user._id] = user;
      });

      env.extras.puncher.stop();

      // reset pending list to avoid multiple joins on server subrequests
      env.data.users = [];

      callback();
    });
  });
};
