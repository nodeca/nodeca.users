'use strict';

module.exports = function (N, apiPath) {
  var User = N.models.users.User;

  N.validate(apiPath, {
    user_hid: {
      type: 'integer',
      minimum: 1,
      required: true
    }
  });


  // Fetch member by 'user_hid'
  //
  N.wire.on(apiPath, function fetch_user_by_hid(env, callback) {
    User
      .findOne({ 'hid': env.params.user_hid })
      .lean(true)
      .exec(function (err, user) {
        if (err) {
          callback(err);
          return;
        }

        // TODO: add permissions to view deleted users
        if (!user || !user.exists) {
          callback(N.io.NOT_FOUND);
          return;
        }

        env.data.user = user;
        env.res.user_hid = user.hid;
        callback();
      });
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

    env.res.blocks.breadcrumbs = breadcrumbs;
  });
};
