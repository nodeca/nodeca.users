// Fill about block stub
//
'use strict';


const _ = require('lodash');


module.exports = function (N) {

  // Fill contacts
  //
  N.wire.after('server:users.member', function fill_about(env) {
    let about = env.data.user.about || {};

    // initialize list and extra unless they exist already
    _.set(env.res, 'blocks.about.list',  _.get(env.res, 'blocks.about.list') || []);
    _.set(env.res, 'blocks.about.extra', _.get(env.res, 'blocks.about.extra') || []);

    env.res.blocks.about.list.push({
      name:     'joined',
      value:    env.helpers.date(env.data.user.joined_ts, 'date'),
      priority: 10
    });

    env.res.blocks.about.list.push({
      name:     'post_count',
      value:    env.data.user.post_count,
      priority: 20
    });

    if (N.config.users && N.config.users.about) {
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
