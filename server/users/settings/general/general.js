// Show settings page
//
'use strict';

const _ = require('lodash');


module.exports = function (N, apiPath) {

  N.validate(apiPath, {});


  // Check permissions
  //
  N.wire.before(apiPath, async function check_permissions(env) {
    await N.wire.emit('internal:users.force_login_guest', env);
    // if (!env.user_info.is_member) return N.io.FORBIDDEN;
  });


  // Fetch user
  //
  N.wire.before(apiPath, async function fetch_user(env) {
    env.data.user = await N.models.users.User.findOne({ _id: env.user_info.user_id });
  });


  // Fetch permissions
  //
  N.wire.before(apiPath, async function fetch_permissions(env) {
    let can_edit_profile = await env.extras.settings.fetch('can_edit_profile');

    env.res.settings = env.res.settings || {};
    env.res.settings.can_edit_profile = can_edit_profile;
  });


  // Fill response
  //
  N.wire.on(apiPath, async function fill_response(env) {
    let settings = (await N.models.users.UserSettings.findOne({ user: env.user_info.user_id }).lean(true)) || {};

    let setting_schemas = N.config.setting_schemas.user || {};

    env.res.setting_schemas = _.pickBy(setting_schemas, setting => !setting.hidden);
    env.res.setting_values  = _.pickBy(settings, (setting, name) =>
                                  setting_schemas[name] && !setting_schemas[name].hidden);
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
