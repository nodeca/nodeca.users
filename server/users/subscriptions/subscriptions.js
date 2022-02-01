// Show settings page
//
'use strict';


const _ = require('lodash');


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


  // Fetch tracked items
  //
  N.wire.on(apiPath, async function fetch_items(env) {
    let menu = N.config.users?.subscriptions || {};
    let tab_types = Object.keys(menu)
                          .sort((a, b) => (menu[a].priority ?? 100) - (menu[b].priority ?? 100));

    let type = env.params.$query?.type || tab_types[0];

    // validate tab type
    if (tab_types.indexOf(type) === -1) {
      throw N.io.BAD_REQUEST;
    }

    env.res.tabs = tab_types.map(type => {
      let subscription_types = new Set(
        [ menu[type].to_type ].flat().map(x => N.shared.content_type[x])
      );

      return {
        type,
        marker_type: menu[type].marker_type,
        count: env.data.subscriptions.filter(s => subscription_types.has(s.to_type)).length
      };
    });

    let subscription_types = new Set(
      [ menu[type].to_type ].flat().map(x => N.shared.content_type[x])
    );

    env.data.subscriptions = env.data.subscriptions.filter(s => subscription_types.has(s.to_type));

    await N.wire.emit('internal:users.subscriptions.fetch', env);

    env.res.items = env.data.subscriptions;
    env.res.type = type;

    // last time this list was updated on the client, this is required for "mark all" button
    env.res.mark_cut_ts = Date.now();
  });


  // Delete missed subscriptions
  //
  N.wire.after(apiPath, async function remove_missed_subscriptions(env) {
    if (!env.data.missed_subscriptions?.length) return;

    // Exclude from fetched
    env.data.subscriptions = _.difference(env.data.subscriptions, env.data.missed_subscriptions);

    // Remove from database
    await N.models.users.Subscription.deleteMany()
              .where('_id').in(env.data.missed_subscriptions.map(x => x._id));
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