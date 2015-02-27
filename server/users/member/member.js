'use strict';

var _ = require('lodash');

module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid: {
      type: 'integer',
      minimum: 1,
      required: true
    }
  });

  var blocks = _.map(
    N.config.users.member_page.blocks,
    function (v, k) {
      return _.assign({ name: k }, v);
    }
  );
  blocks = _.sortBy(blocks, _.property('priority'));

  var menu = _.map(
    N.config.users.member_page.menu,
    function (v, k) {
      return _.assign({ name: k }, v);
    }
  );
  menu = _.sortBy(menu, _.property('priority'));


  // Fetch member by 'user_hid'
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env, callback) {
    N.wire.emit('internal:users.fetch_user_by_hid', env, callback);
  });


  // Update activity info with fresh data if available
  //
  N.wire.before(apiPath, function fetch_activity_info(env, callback) {
    N.redis.zscore('users:last_active', env.data.user._id, function (__, score) {
      // Score not found, use `last_active_ts` from mongodb
      if (!score) {
        callback();
        return;
      }

      // Use fresh `last_active_ts` from redis
      env.data.user.last_active_ts = new Date(parseInt(score, 10));

      callback();
    });
  });


  // Fill response
  //
  N.wire.on(apiPath, function fetch_user_by_hid(env, callback) {
    env.res.user = {};
    env.res.user._id = env.data.user._id;
    env.res.user.hid = env.data.user.hid;
    env.res.user.last_active_ts = env.data.user.last_active_ts;

    env.res.avatar_exists = env.data.user.avatar_id ? true : false;

    env.res.menu_ordered = menu;
    env.res.blocks_ordered = blocks;

    env.data.users = env.data.users || [];
    env.data.users.push(env.data.user._id);

    callback();
  });


  //Fill head and breadcrumbs
  //
  N.wire.after(apiPath, function fill_head_and_breadcrumbs(env) {
    var user = env.data.user;
    var name = env.runtime.is_member ? user.name : user.nick;

    env.res.head = env.res.head || {};
    env.res.head.title = name;


    N.wire.emit('internal:users.breadcrumbs.fill_user', env);

    // Doesn't show avatar in breadcrumbs on member page
    env.data.breadcrumbs[0].show_avatar = false;

    env.res.breadcrumbs = env.data.breadcrumbs;
  });


  // Stub for unimplemented blocks
  //
  N.wire.after(apiPath, function stub(env) {
    // TODO

    env.res.blocks = env.res.blocks || {};

    if (String(env.data.user._id) === env.user_info.user_id) {
      env.res.blocks.notepad = {};
    }

    env.res.blocks.about = {};
    env.res.blocks.bookmarks = {};
    env.res.blocks.friends = {};
    env.res.blocks.blog = {};
  });
};
