// Show settings page
//
'use strict';


var _ = require('lodash');


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
  N.wire.before(apiPath, function fetch_user(env, callback) {
    N.models.users.User.findOne({ _id: env.user_info.user_id }).exec(function (err, user) {

      if (err) {
        callback(err);
        return;
      }

      env.data.user = user;
      callback();
    });
  });


  // Fetch subscriptions
  //
  N.wire.before(apiPath, function fetch_subscriptions(env, callback) {
    var list_visible = [
      N.models.users.Subscription.types.WATCHING,
      N.models.users.Subscription.types.TRACKING,
      N.models.users.Subscription.types.MUTED
    ];

    N.models.users.Subscription.find()
        .where('user_id').equals(env.user_info.user_id)
        .where('type').in(list_visible)
        .sort('-_id')
        .lean(true)
        .exec(function (err, subscriptions) {

      if (err) {
        callback(err);
        return;
      }

      env.data.subscriptions = subscriptions;
      callback();
    });
  });


  // Fetch subscribed items subcall
  //
  N.wire.on(apiPath, function fetch_subscribed_items_subcall(env, callback) {
    N.wire.emit('internal:users.subscriptions.fetch', env, callback);
  });


  // Fill tabs
  //
  N.wire.after(apiPath, function fill_tabs(env) {
    var tabs = _.reduce((N.config.users || {}).subscriptions || {}, function (acc, tab_confog, block_name) {
      acc.push(_.assign({
        block_name: block_name,
        priority: 10,
        items: _.filter(env.data.subscriptions, { to_type: tab_confog.to_type })
      }, tab_confog));

      return acc;
    }, []);

    tabs = _.sortBy(tabs, 'priority');

    env.res.tabs = tabs;
  });


  // Fill head and breadcrumbs
  //
  N.wire.after(apiPath, function fill_head_and_breadcrumbs(env) {
    env.res.head = env.res.head || {};
    env.res.head.title = env.t('title');

    N.wire.emit('internal:users.breadcrumbs.fill_user', env);

    env.res.breadcrumbs = env.data.breadcrumbs;
  });
};
