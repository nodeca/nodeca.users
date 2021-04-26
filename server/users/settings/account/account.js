// Form to change email or password
//
'use strict';


const uaParser = require('ua-parser-js');


module.exports = function (N, apiPath) {

  N.validate(apiPath, {});


  // Check permissions
  //
  N.wire.before(apiPath, function check_permissions(env) {
    if (!env.user_info.is_member) {
      return N.io.FORBIDDEN;
    }
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


  // Fill account data
  //
  N.wire.on(apiPath, function account_data(env) {
    // keep first 2 and last 2 characters, replace the rest with 10 stars
    env.res.email = (env.data.user.email || '').replace(/(?<=^..).+(?=..$)/, '*'.repeat(10));
  });


  function get_device(user_agent) {
    let parsed  = uaParser(user_agent);
    let browser = parsed.browser.name || 'Unknown';
    let os      = parsed.os.name      || 'Unknown';

    return `${browser}, ${os}`;
  }


  // Fill sessions data
  //
  N.wire.on(apiPath, async function session_data(env) {
    let active_sessions = await N.models.users.AuthSession.find()
                                    .where('user').equals(env.user_info.user_id)
                                    .sort('-last_ts')
                                    .lean(true);

    env.res.active_sessions = active_sessions.map(session => ({
      current:    session.session_id === env.session_id,
      last_ts:    session.last_ts,
      user_agent: session.user_agent,
      device:     get_device(session.user_agent),
      ip:         session.ip
    }));

    let closed_sessions = await N.models.users.AuthSessionLog.find()
                                    .where('user').equals(env.user_info.user_id)
                                    .sort('-last_ts')
                                    .limit(5)
                                    .lean(true);

    env.res.closed_sessions = closed_sessions.map(session => ({
      last_ts:    session.last_ts,
      user_agent: session.user_agent,
      device:     get_device(session.user_agent),
      ip:         session.ip
    }));
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
