'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid: {
      type: 'integer',
      minimum: 1,
      required: true
    }
  });


  // Fetch member by 'user_hid'
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env, callback) {
    N.wire.emit('internal:users.fetch_user_by_hid', env, callback);
  });


  // Fill response
  //
  N.wire.on(apiPath, function fetch_user_by_hid(env, callback) {
    env.res.user_hid = env.data.user.hid;
    callback();
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
