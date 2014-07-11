// Shows albums list page


'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid: {
      type: 'integer',
      minimum: 1,
      required: true
    }
  });


  // Fetch owner
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env, callback) {
    N.wire.emit('internal:users.fetch_user_by_hid', env, callback);
  });


  // Get albums list (subcall)
  //
  N.wire.on(apiPath, function get_user_albums(env, callback) {
    // For check is user owner
    env.res.user_hid = env.data.user.hid;

    // Show albums list
    N.wire.emit('server:users.albums_root.list', env, callback);
  });


  // Fill head meta
  //
  N.wire.after(apiPath, function fill_head(env) {
    var user = env.data.user;

    env.res.head = env.res.head || {};
    env.res.head.title = env.t('title_with_user', { user: env.runtime.is_member ? user.name : user.nick });
  });


  // Fill breadcrumbs
  //
  N.wire.after(apiPath, function fill_breadcrumbs(env) {
    var user = env.data.user;

    var breadcrumbs = [];

    breadcrumbs.push({
      'text': env.runtime.is_member ? user.name : user.nick,
      'route': 'users.member',
      'params': { 'user_hid': user.hid }
    });

    breadcrumbs.push({
      'text': env.t('breadcrumbs_title'),
      'route': 'users.albums_root',
      'params': { 'user_hid': user.hid }
    });

    env.res.breadcrumbs = breadcrumbs;
  });
};
