'use strict';

module.exports = function (N, apiPath) {


  // Fill user name
  //
  N.wire.on(apiPath, function fill_user_name(env) {
    var user = env.data.user;
    env.data.breadcrumbs = env.data.breadcrumbs || [];

    env.data.breadcrumbs.push({
      text   : env.runtime.is_member ? user.name : user.nick,
      route  : 'users.member',
      params : { 'user_hid': user.hid }
    });
  });
};
