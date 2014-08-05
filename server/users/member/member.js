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


  // Fill response
  //
  N.wire.on(apiPath, function fetch_user_by_hid(env, callback) {
    env.res.user = {};
    env.res.user.hid = env.data.user.hid;
    env.res.user.avatar_id = env.data.user.avatar_id;
    callback();
  });

  // Fill menu and blocks
  //
  N.wire.after(apiPath, function fill_menu_config(env) {
    env.res.menu_ordered = menu;
    env.res.blocks_ordered = blocks;
  });


  //Fill breadcrumbs
  //
  N.wire.after(apiPath, function fill_head_and_breadcrumbs(env) {
    var user = env.data.user;
    var name = env.runtime.is_member ? user.name : user.nick;

    env.res.head = env.res.head || {};
    env.res.head.title = name;

    var breadcrumbs = [];

    breadcrumbs.push({
      'text': name,
      'route': 'users.member',
      'params': { 'user_hid': env.data.user.hid }
    });

    env.res.breadcrumbs = breadcrumbs;
  });
};
