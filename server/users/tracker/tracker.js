// Fill tracker
//
// env.res.items:
//
// - type - template block
// - last_ts - sort timestamp
// - id - data _id
//
'use strict';


var _ = require('lodash');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});


  // Redirect guests to login page
  //
  N.wire.before(apiPath, function check_user_auth(env) {
    return N.wire.emit('internal:users.force_login_guest', env);
  });


  // Fetch subscriptions for user
  //
  N.wire.before(apiPath, function* fetch_subscriptions(env) {
    env.data.subscriptions = yield N.models.users.Subscription
                                      .find()
                                      .where('user_id').equals(env.user_info.user_id)
                                      .where('type').in(N.models.users.Subscription.types.LIST_SUBSCRIBED)
                                      .lean(true);
  });


  // Fetch tracked items subcall
  //
  N.wire.on(apiPath, function fetch_items_subcall(env) {
    env.data.items = [];
    return N.wire.emit('internal:users.tracker.fetch', env);
  });


  // Sort tracked items
  //
  N.wire.after(apiPath, function sort_items(env) {
    env.data.items = _.orderBy(env.data.items, 'last_ts', 'desc');
  });


  // Fill response
  //
  N.wire.after(apiPath, function fill_response(env) {
    env.res.items = env.data.items;
  });


  // Fill head meta
  //
  N.wire.after(apiPath, function fill_head(env) {
    env.res.head = env.res.head || {};
    env.res.head.title = env.t('title_with_user', { user: env.user_info.user_name });
  });


  // Fill breadcrumbs
  //
  N.wire.after(apiPath, function fill_breadcrumbs(env) {
    env.data.breadcrumbs = env.data.breadcrumbs || [];

    env.data.breadcrumbs.push({
      text        : env.user_info.user_name,
      route       : 'users.member',
      params      : { user_hid: env.user_info.user_hid },
      user_id     : env.user_info.user_id,
      avatar_id   : env.user_info.user_avatar,
      show_avatar : true
    });

    env.data.breadcrumbs.push({
      text   : env.t('@users.tracker.breadcrumbs_title'),
      route  : 'users.tracker',
      params : { user_hid: env.user_info.user_hid }
    });

    env.res.breadcrumbs = env.data.breadcrumbs;
  });
};
