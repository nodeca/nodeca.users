// Fill about block stub
//
'use strict';


module.exports = function (N) {

  // Fetch permissions
  //
  N.wire.after('server:users.member', async function fetch_permissions(env) {
    let can_edit_profile = await env.extras.settings.fetch('can_edit_profile');

    env.res.settings = env.res.settings || {};
    env.res.settings.can_edit_profile = can_edit_profile;
  });

  // Fill contacts
  //
  N.wire.after('server:users.member', async function fill_about(env) {
    let about = env.data.user.about || {};
    let own_page = String(env.data.user._id) === env.user_info.user_id;

    // only show contacts to registered users
    let show_contacts = env.user_info.is_member;

    // initialize list and extra unless they exist already
    env.res.blocks = env.res.blocks || {};
    env.res.blocks.about = env.res.blocks.about || {};
    env.res.blocks.about.list = env.res.blocks.about.list || [];
    env.res.blocks.about.extra = env.res.blocks.about.extra || [];

    // get total activity counter
    let data = { user_id: env.data.user._id, current_user_info: env.user_info };
    await N.wire.emit('internal:users.activity.get', data);

    env.res.blocks.about.list.push({
      name:     'activity',
      value:    data.count,
      priority: 10
    });

    if (show_contacts && env.data.user.location || own_page) {
      env.res.blocks.about.list.push({
        name:     'location',
        value:    env.data.user.location ? {
          location: env.data.user.location,
          name:     (await N.models.core.Location.info([ env.data.user.location ], env.user_info.locale))[0]
        } : null,
        priority: 30
      });
    }

    env.res.blocks.about.list.push({
      name:     'joined',
      value:    env.data.user.joined_ts,
      priority: 40
    });

    if (N.config.users?.about && show_contacts) {
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

    env.res.blocks.about.list  = env.res.blocks.about.list.sort((a, b) => a.priority - b.priority);
    env.res.blocks.about.extra = env.res.blocks.about.extra.sort((a, b) => a.priority - b.priority);
  });
};
