// fetch user info, for popover (rpc only)
//
'use strict';

const _ = require('lodash');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    user_hid: { type: 'integer', minimum: 1, required: true }
  });


  // Fetch member by 'user_hid'
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env) {
    return N.wire.emit('internal:users.fetch_user_by_hid', env);
  });


  // Fetch infractions info
  //
  N.wire.before(apiPath, function* fetch_infractions(env) {

    // Fill penalty info
    //
    let penalty = yield N.models.users.UserPenalty.findOne()
                            .where('user').equals(env.data.user._id)
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


  // Update activity info with fresh data if available
  //
  N.wire.before(apiPath, function* fetch_activity_info(env) {
    if (String(env.data.user._id) === env.user_info.user_id) {
      // User is viewing her own profile. Since redis last_active_ts is not
      // yet updated, just show her the current redis time.
      //
      let time = yield N.redis.timeAsync();

      env.data.user.last_active_ts = new Date(Math.floor(time[0] * 1000 + time[1] / 1000));
      return;
    }

    let score = yield N.redis.zscoreAsync('users:last_active', String(env.data.user._id));

    // Score not found, use `last_active_ts` from mongodb
    if (!score) return;

    // Use fresh `last_active_ts` from redis
    env.data.user.last_active_ts = new Date(parseInt(score, 10));
  });


  // Check if we can send a message to that user
  //
  N.wire.before(apiPath, function* fill_dialog_permissions(env) {
    if (!env.user_info.is_member) return;
    if (String(env.data.user._id) === String(env.user_info.user_id)) return;

    let settings = yield env.extras.settings.fetch([
      'can_use_dialogs',
      'can_create_dialogs'
    ]);

    let recipient_can_use_dialogs = yield N.settings.get('can_use_dialogs', {
      user_id: env.data.user._id,
      usergroup_ids: env.data.user.usergroups
    }, {});

    if (settings.can_use_dialogs &&
        settings.can_create_dialogs &&
        recipient_can_use_dialogs) {

      env.res.can_create_dialog_with_user = true;
    }
  });


  // Fill user
  //
  N.wire.on(apiPath, function* fill_user(env) {
    env.res.user = _.pick(env.data.user, [
      '_id',
      'hid',
      'joined_ts',
      'nick',
      'post_count',
      'last_active_ts'
    ]);

    // only show contacts to registered users
    let show_contacts = env.user_info.is_member;

    // only registered users can see full name and avatar
    if (env.user_info.is_member) {
      env.res.user.name = env.data.user.name;
      env.res.user.avatar_id = env.data.user.avatar_id;
    } else {
      env.res.user.name = env.data.user.nick;
      env.res.user.avatar_id = null;
    }

    let birthday = env.data.user.about && env.data.user.about.birthday;

    if (birthday && show_contacts) {
      let now = new Date();
      let age = now.getFullYear() - birthday.getFullYear();

      if (now.getMonth() < birthday.getMonth()) age--;
      if (now.getMonth() === birthday.getMonth() && now.getDate() < birthday.getDate()) age--;

      env.res.age = Math.max(age, 0);
    }

    if (env.data.user.location && show_contacts) {
      env.res.location      = env.data.user.location;
      env.res.location_name = (yield N.models.core.Location.info([ env.data.user.location ], env.user_info.locale))[0];
    }
  });
};
