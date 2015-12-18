// fetch user info, for popover (rpc only)
//
'use strict';


var user_fields = [
  '_id',
  'hid',
  'joined_ts',
  'name',
  'nick',
  'post_count',
  'avatar_id'
];


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    user_hid: { type: 'integer', minimum: 1, required: true }
  });


  // Fetch user
  //
  N.wire.before(apiPath, function fetch_user(env, callback) {

    // Fetch permission to see deleted users
    env.extras.settings.fetch('can_see_deleted_users', function (err, can_see_deleted_users) {
      if (err) {
        callback(err);
        return;
      }

      var params = { hid: env.params.user_hid };

      if (!can_see_deleted_users) {
        params.exists = true;
      }

      // Fetch user
      N.models.users.User.findOne(params)
          .select(user_fields.join(' '))
          .lean(true)
          .exec(function (err, res) {

        if (err) {
          callback(err);
          return;
        }

        if (!res) {
          callback(N.io.NOT_FOUND);
          return;
        }

        env.data.user = res;
        callback();
      });
    });
  });


  // Fill user
  //
  N.wire.on(apiPath, function fill_user(env) {
    var user = env.data.user;

    // only registered users can see full name and avatar
    if (!env.user_info.is_member) {
      user.name = user.nick;
      user.avatar_id = null;
    }

    env.res.user = user;
  });
};
