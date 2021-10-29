// Form for user to choose their location
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
  });


  // Fetch user
  //
  N.wire.before(apiPath, async function fetch_user(env) {
    env.data.user = await N.models.users.User.findOne({ _id: env.user_info.user_id });
  });


  // Fill location
  //
  N.wire.on(apiPath, function fill_location(env) {
    if (!env.data.user.location) return;

    env.res.location = env.data.user.location;
  });


  // Fill head and breadcrumbs
  //
  N.wire.after(apiPath, async function fill_head_and_breadcrumbs(env) {
    env.res.head = env.res.head || {};
    env.res.head.title = env.t('title');

    await N.wire.emit('internal:users.breadcrumbs.fill_root', env);

    env.data.breadcrumbs.push({
      text: env.t('@users.settings.general.breadcrumbs_title'),
      route: 'users.settings.general'
    });

    env.data.breadcrumbs.push({
      text: env.t('breadcrumbs_title')
    });

    env.res.breadcrumbs = env.data.breadcrumbs;
  });
};
