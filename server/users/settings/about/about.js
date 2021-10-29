// Form to edit user profile
//
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {});

  // Check permissions
  //
  N.wire.before(apiPath, async function check_permissions(env) {
    await N.wire.emit('internal:users.force_login_guest', env);
    // if (!env.user_info.is_member) throw N.io.FORBIDDEN;

    let can_edit_profile = await env.extras.settings.fetch('can_edit_profile');

    if (!can_edit_profile) throw N.io.FORBIDDEN;

    env.res.settings = env.res.settings || {};
    env.res.settings.can_edit_profile = can_edit_profile;
  });


  // Fetch user
  //
  N.wire.before(apiPath, async function fetch_user(env) {
    env.data.user = await N.models.users.User.findOne({ _id: env.user_info.user_id });
  });


  // Fill contacts
  //
  N.wire.on(apiPath, async function fill_contacts(env) {
    let about = env.data.user.about || {};

    env.res.about = [];

    env.res.about.push({
      name:     'location',
      value:    env.data.user.location ? {
        location: env.data.user.location,
        name:     (await N.models.core.Location.info([ env.data.user.location ], env.user_info.locale))[0]
      } : null,
      priority: 10
    });

    if (N.config.users?.about) {
      for (let name of Object.keys(N.config.users.about)) {
        env.res.about.push({
          name,
          value:    about[name],
          priority: N.config.users.about[name].priority
        });
      }
    }
  });


  // Sort fields based on priority
  //
  N.wire.after(apiPath, function sort_fields(env) {
    env.res.about = env.res.about.sort((a, b) => a.priority - b.priority);
  });


  // Fill head and breadcrumbs
  //
  N.wire.after(apiPath, async function fill_head_and_breadcrumbs(env) {
    env.res.head = env.res.head || {};
    env.res.head.title = env.t('title');

    await N.wire.emit('internal:users.breadcrumbs.fill_root', env);

    env.data.breadcrumbs.push({
      text: env.t('breadcrumbs_title'),
      route: 'users.settings.general'
    });

    env.res.breadcrumbs = env.data.breadcrumbs;
  });
};
