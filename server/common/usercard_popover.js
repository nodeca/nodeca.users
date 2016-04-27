// fetch user info, for popover (rpc only)
//
'use strict';


const user_fields = [
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


  // Fetch infractions info
  //
  N.wire.before(apiPath, function* fetch_infractions(env) {

    // Fill penalty info
    //
    let penalty = yield N.models.users.UserPenalty.findOne()
                            .where('user_id').equals(env.data.user._id)
                            .lean(true);

    if (penalty && penalty.expire) {
      env.res.penalty_expire = penalty.expire;
    }


    // Fill infractions info
    //
    let can_see_infractions = yield env.extras.settings.fetch('can_see_infractions');

    if (!can_see_infractions) return;

    let infractions = yield N.models.users.Infraction.find()
                                .where('for').equals(env.data.user._id)
                                .where('exists').equals(true)
                                .select('points expire')
                                .lean(true);
    let now = Date.now();
    let points = infractions.reduce((acc, infraction) => {
      if (!infraction.expire || infraction.expire > now) acc += infraction.points;
      return acc;
    }, 0);

    env.res.infractions_points = points;
  });


  // Fill permissions to use messages
  //
  N.wire.before(apiPath, function* fill_messages_permissions(env) {
    env.res.settings = yield env.extras.settings.fetch([
      'can_use_messages',
      'can_send_messages'
    ]);
  });


  // Fill user
  //
  N.wire.on(apiPath, function fill_user(env) {
    let user = env.data.user;

    // only registered users can see full name and avatar
    if (!env.user_info.is_member) {
      user.name = user.nick;
      user.avatar_id = null;
    }

    env.res.user = user;
  });
};
