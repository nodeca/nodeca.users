// Fill about block stub
//
'use strict';


const _ = require('lodash');


module.exports = function (N) {

  // Fetch permissions
  //
  N.wire.after('server:users.member', function* fetch_permissions(env) {
    let can_edit_profile = yield env.extras.settings.fetch('can_edit_profile');

    env.res.settings = env.res.settings || {};
    env.res.settings.can_edit_profile = can_edit_profile;
  });

  // Fill contacts
  //
  N.wire.after('server:users.member', function fill_about(env) {
    let about = env.data.user.about || {};

    // only show contacts to registered users
    let show_contacts = env.user_info.is_member;

    // initialize list and extra unless they exist already
    _.set(env.res, 'blocks.about.list',  _.get(env.res, 'blocks.about.list') || []);
    _.set(env.res, 'blocks.about.extra', _.get(env.res, 'blocks.about.extra') || []);

    env.res.blocks.about.list.push({
      name:     'post_count',
      value:    env.data.user.post_count,
      priority: 10
    });

    let birthday = env.data.user.about && env.data.user.about.birthday;

    if (birthday && show_contacts) {
      let now = new Date();
      let age = now.getFullYear() - birthday.getFullYear();

      if (now.getMonth() < birthday.getMonth()) age--;
      if (now.getMonth() === birthday.getMonth() && now.getDate() < birthday.getDate()) age--;

      env.res.blocks.about.list.push({
        name:     'age',
        value:    age,
        priority: 20
      });
    }

    if (show_contacts) {
      env.res.blocks.about.list.push({
        name:     'location',
        value:    { point: [ 0, 0 ], name: 'Null Island' },
        priority: 30
      });
    }

    env.res.blocks.about.list.push({
      name:     'joined',
      value:    env.helpers.date(env.data.user.joined_ts, 'date'),
      priority: 40
    });

    if (N.config.users && N.config.users.about && show_contacts) {
      for (let name of Object.keys(N.config.users.about)) {
        if (!about[name]) continue;

        let schema = N.config.users.about[name];

        if (!schema.priority || schema.priority < 0) continue;

        let list_type = schema.priority >= 100 ? 'extra' : 'list';

        env.res.blocks.about[list_type].push({
          name,
          value:    about[name],
          title:    env.t('@users.about.' + name),
          priority: schema.priority
        });
      }
    }

    env.res.blocks.about.list  = _.sortBy(env.res.blocks.about.list, _.property('priority'));
    env.res.blocks.about.extra = _.sortBy(env.res.blocks.about.extra, _.property('priority'));
  });
};
