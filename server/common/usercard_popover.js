// fetch user info, for popover (rpc only)
//
'use strict';


var user_in_fields = [
  '_id',
  'hid',
  'joined_ts',
  'name',
  'nick',
  'post_count'
];

module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    id: { format: 'mongo', required: true }
  });


  // Fetch permission to see deleted users
  //
  N.wire.before(apiPath, function fetch_can_see_deleted_users(env, callback) {
    env.extras.settings.fetch(['can_see_deleted_users'], function (err, settings) {
      if (err) {
        callback(err);
        return;
      }

      env.data.settings = env.data.settings || {};
      env.data.settings.can_see_deleted_users = settings.can_see_deleted_users;
      callback();
    });
  });


  // FIXME reject for guests
  //
  // ##### params
  //
  // - `id`   User._id
  //
  N.wire.on(apiPath, function user_popover_info(env, callback) {

    var query = N.models.users.User
      .findOne({ _id: env.params.id })
      .lean(true)
      .select(user_in_fields.join(' '));

    // Check 'can_see_deleted_users' permission
    if (!env.data.settings.can_see_deleted_users) {
      query.where({ 'exists': true });
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

      // sanitize user info for guests: show nick instead of user name
      if (env.user_info.is_guest) {
        user.name = user.nick;
      }

      env.res.user = user;
      callback();
    });
  });
};
