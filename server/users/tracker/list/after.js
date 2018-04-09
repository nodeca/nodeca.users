// Load next page when user scrolls down
//
'use strict';


const _ = require('lodash');

const ITEMS_PER_PAGE = 50;


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    type:  { type: 'string', required: true },
    start: { type: 'number', required: true }
  });


  // Redirect guests to login page
  //
  N.wire.before(apiPath, function check_user_auth(env) {
    return N.wire.emit('internal:users.force_login_guest', env);
  });


  // Fetch subscriptions for user
  //
  N.wire.before(apiPath, async function fetch_subscriptions(env) {
    env.data.subscriptions = await N.models.users.Subscription.find()
                                      .where('user').equals(env.user_info.user_id)
                                      .where('type').in(N.models.users.Subscription.types.LIST_SUBSCRIBED)
                                      .lean(true);
  });


  // Fetch tracked items
  //
  N.wire.on(apiPath, async function fetch_items(env) {
    let menu = _.get(N.config, 'users.tracker.menu', {});
    let tab_types = Object.keys(menu)
                          .sort((a, b) => (menu[a].priority || 100) - (menu[b].priority || 100));

    let type = env.params.type;

    // validate tab type
    if (tab_types.indexOf(type) === -1) {
      throw N.io.BAD_REQUEST;
    }

    let fetch_env = {
      params: {
        user_info: env.user_info,
        subscriptions: env.data.subscriptions,
        start: env.params.start,
        limit: ITEMS_PER_PAGE
      }
    };

    await N.wire.emit('internal:users.tracker.fetch.' + type, fetch_env);

    env.data.users = (env.data.users || []).concat(fetch_env.users);
    env.res = Object.assign(env.res, fetch_env.res);
    env.res.type  = type;
    env.res.items = fetch_env.items;
    env.res.next  = fetch_env.next;
  });
};
