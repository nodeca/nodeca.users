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
  N.wire.before(apiPath, function* fetch_user(env) {

    // Fetch permission to see deleted users
    let can_see_deleted_users = yield env.extras.settings.fetch('can_see_deleted_users');

    let params = { hid: env.params.user_hid };

    if (!can_see_deleted_users) {
      params.exists = true;
    }

    // Fetch user
    let res = yield N.models.users.User.findOne(params).select(user_fields.join(' ')).lean(true);

    if (!res) throw N.io.NOT_FOUND;

    env.data.user = res;
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
