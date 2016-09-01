// Show ignore list
//
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {});


  // Check permissions
  //
  N.wire.before(apiPath, function check_permissions(env) {
    if (env.user_info.is_guest) {
      return N.io.FORBIDDEN;
    }
  });


  // Fetch user
  //
  N.wire.before(apiPath, function* fetch_user(env) {
    env.data.user = yield N.models.users.User.findOne({ _id: env.user_info.user_id });
  });


  // Fetch permissions
  //
  N.wire.before(apiPath, function* fetch_permissions(env) {
    let can_edit_profile = yield env.extras.settings.fetch('can_edit_profile');

    env.res.settings = env.res.settings || {};
    env.res.settings.can_edit_profile = can_edit_profile;
  });


  // Fill response
  //
  N.wire.on(apiPath, function* fill_response(env) {
    let ignore_list = yield N.models.users.Ignore.find({
      from: env.user_info.user_id
    }).sort('-ts');

    env.data.users = ignore_list.map(row => row.to);

    env.res.ignore_list = ignore_list.map(row => ({
      user_id: row.to,
      ts:      row.ts,
      expire:  row.expire,
      reason:  row.reason
    }));
  });


  // Fill head and breadcrumbs
  //
  N.wire.after(apiPath, function* fill_head_and_breadcrumbs(env) {
    env.res.head = env.res.head || {};
    env.res.head.title = env.t('title');

    yield N.wire.emit('internal:users.breadcrumbs.fill_root', env);

    env.data.breadcrumbs.push({
      text: env.t('breadcrumbs_title'),
      route: 'users.settings.general'
    });

    env.res.breadcrumbs = env.data.breadcrumbs;
  });
};
