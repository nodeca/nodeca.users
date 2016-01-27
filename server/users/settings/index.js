// Show settings page
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


  // Fill response
  //
  N.wire.on(apiPath, function* fill_response(env) {
    let settings = yield N.models.users.UserSettings.findOne({ user_id: env.user_info.user_id });

    env.res.setting_schemas = N.config.setting_schemas.user || {};
    env.res.settings = settings || {};
  });


  // Fill head and breadcrumbs
  //
  N.wire.after(apiPath, function* fill_head_and_breadcrumbs(env) {
    env.res.head = env.res.head || {};
    env.res.head.title = env.t('title');

    yield N.wire.emit('internal:users.breadcrumbs.fill_user', env);

    env.res.breadcrumbs = env.data.breadcrumbs;
  });
};
