// Edit user
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


  // Fill penalty info
  //
  N.wire.before(apiPath, function* fill_penalty_info(env) {
    let penalty = yield N.models.users.UserPenalty.findOne()
                            .where('user').equals(env.data.user._id)
                            .lean(true);

    if (penalty && penalty.expire) {
      env.res.penalty_expire = penalty.expire;
    }
  });


  // Fill user
  //
  N.wire.on(apiPath, function* fill_user(env) {
    env.res.head = env.res.head || {};
    env.res.head.title = env.data.user.name;

    env.res.user = _.pick(env.data.user, [
      '_id',
      'hid',
      'avatar_id',
      'name',
      'exists'
    ]);

    let user = env.data.user;
    let about = user.about || {};

    env.res.fields = [];

    env.res.fields.push({
      name:     'nick',
      value:    user.nick,
      priority: 10
    });

    env.res.fields.push({
      name:     'email',
      value:    user.email,
      priority: 20
    });

    env.res.fields.push({
      name:     'usergroups',
      value:    user.usergroups,
      values:   yield N.settings.customizers.usergroups(),
      priority: 30
    });

    env.res.fields.push({
      name:     'birthday',
      value:    about.birthday && !isNaN(about.birthday) ?
                about.birthday.toISOString().slice(0, 10) :
                null,
      priority: 40
    });

    if (N.config.users && N.config.users.about) {
      for (let name of Object.keys(N.config.users.about)) {
        env.res.fields.push({
          name,
          value:    about[name],
          priority: N.config.users.about[name].priority
        });
      }
    }

    if (env.data.user.location) {
      env.res.fields.push({
        name:     'location',
        value:    env.data.user.location ? {
          location: env.data.user.location,
          name:     (yield N.models.core.Location.info([ env.data.user.location ], env.user_info.locale))[0]
        } : null,
        priority: 210
      });
    }

    env.res.fields.push({
      name:     'registered',
      text:     env.t('registered_date_ip', {
        date: user.joined_ts ? user.joined_ts.toISOString().slice(0, 10) : '—',
        ip:   user.joined_ip || '—'
      }),
      priority: 210
    });

    env.res.fields.push({
      name:     'last_visited',
      text:     user.last_active_ts ? user.last_active_ts.toISOString().slice(0, 10) : '—',
      priority: 220
    });

    env.res.fields.push({
      name:     'post_count',
      text:     user.post_count || 0,
      priority: 230
    });

    env.res.fields.push({
      name:     'hb',
      value:    user.hb,
      priority: 300
    });
  });


  // Sort fields based on priority
  //
  N.wire.after(apiPath, function sort_fields(env) {
    env.res.fields = _.sortBy(env.res.fields, _.property('priority'));
  });
};
