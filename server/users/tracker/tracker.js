// Fill tracker
//
// env.res.items:
//
// - type - template block
// - last_ts - sort timestamp
// - id - data _id
//
'use strict';


const ITEMS_PER_PAGE = 50;


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    $query: {
      type: 'object',
      required: false,
      properties: {
        type: { type: 'string' }
      }
    }
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
    let menu = N.config.users?.tracker?.menu || {};
    let tab_types = Object.keys(menu)
                          .sort((a, b) => (menu[a].priority ?? 100) - (menu[b].priority ?? 100));

    let type = env.params.$query?.type || tab_types[0];

    // validate tab type
    if (tab_types.indexOf(type) === -1) {
      throw N.io.BAD_REQUEST;
    }

    let fetch_env = {
      params: {
        user_info: env.user_info,
        subscriptions: env.data.subscriptions,
        limit: ITEMS_PER_PAGE
      }
    };

    await N.wire.emit('internal:users.tracker.fetch.' + type, fetch_env);

    env.data.users = (env.data.users || []).concat(fetch_env.users);
    env.res = Object.assign(env.res, fetch_env.res);
    env.res.type        = type;
    env.res.items       = fetch_env.items;
    env.res.reached_end = !fetch_env.next;

    // calculate result counts for other tabs
    let counts = {};

    // set result count for current tab
    counts[type] = fetch_env.count;

    let other_tabs = tab_types.filter(x => x !== type);

    await Promise.all(other_tabs.map(async type => {
      let sub_env = {
        params: {
          user_info: env.user_info,
          subscriptions: env.data.subscriptions,
          limit: 0 // count only
        }
      };

      await N.wire.emit('internal:users.tracker.fetch.' + type, sub_env);

      counts[type] = sub_env.count;
    }));

    env.res.tabs = tab_types.map(type => ({
      type,
      count: counts[type]
    }));
  });


  // Fill head and breadcrumbs
  //
  N.wire.after(apiPath, function fill_head_and_breadcrumbs(env) {
    env.res.head = env.res.head || {};
    env.res.head.title = env.t('title');

    env.data.breadcrumbs = env.data.breadcrumbs || [];

    env.data.breadcrumbs.push({
      text   : env.t('@users.tracker.breadcrumbs_title'),
      route  : 'users.tracker',
      params : { user_hid: env.user_info.user_hid }
    });

    env.res.breadcrumbs = env.data.breadcrumbs;
  });
};
