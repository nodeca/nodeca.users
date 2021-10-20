// Show settings page
//
'use strict';


const _ = require('lodash');


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


  // Fetch subscriptions
  //
  N.wire.before(apiPath, async function fetch_subscriptions(env) {
    let list_visible = [
      N.models.users.Subscription.types.WATCHING,
      N.models.users.Subscription.types.TRACKING,
      N.models.users.Subscription.types.MUTED
    ];

    env.data.subscriptions = await N.models.users.Subscription.find()
                                      .where('user').equals(env.user_info.user_id)
                                      .where('type').in(list_visible)
                                      .sort('-_id')
                                      .lean(true);
  });


  // Fetch subscribed items subcall
  //
  N.wire.on(apiPath, function fetch_subscribed_items_subcall(env) {
    return N.wire.emit('internal:users.subscriptions.fetch', env);
  });


  // Delete missed subscriptions
  //
  N.wire.after(apiPath, async function remove_missed_subscriptions(env) {
    if (!env.data.missed_subscriptions || !env.data.missed_subscriptions.length) return;

    // Exclude from fetched
    env.data.subscriptions = _.difference(env.data.subscriptions, env.data.missed_subscriptions);

    // Remove from database
    await N.models.users.Subscription.deleteMany()
              .where('_id').in(env.data.missed_subscriptions.map(x => x._id));
  });


  // Fill tabs
  //
  N.wire.after(apiPath, function fill_tabs(env) {
    let tabs = [];

    for (let [ block_name, tab_config ] of Object.entries(N.config.users?.subscriptions || {})) {
      let subscription_types = new Set(
        (Array.isArray(tab_config.to_type) ? tab_config.to_type : [ tab_config.to_type ])
          .map(x => N.shared.content_type[x])
      );

      tabs.push(Object.assign({
        block_name,
        priority: 10,
        items: env.data.subscriptions.filter(s => subscription_types.has(s.to_type))
      }, tab_config));
    }

    tabs = _.sortBy(tabs, 'priority');

    env.res.tabs = tabs;
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

    env.data.breadcrumbs.push({
      text   : env.t('@users.subscriptions.breadcrumbs_title')
    });

    env.res.breadcrumbs = env.data.breadcrumbs;
  });
};
