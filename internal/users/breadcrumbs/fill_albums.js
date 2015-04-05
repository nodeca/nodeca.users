'use strict';

module.exports = function (N, apiPath) {


  // Fill user name
  //
  N.wire.on(apiPath, function fill_user_name(env) {
    N.wire.emit('internal:users.breadcrumbs.fill_user', env);
  });


  // Fill albums title
  //
  N.wire.on(apiPath, function fill_albums_title(env) {
    var user = env.data.user;
    env.data.breadcrumbs = env.data.breadcrumbs || [];

    env.data.breadcrumbs.push({
      text   : env.t('@users.albums_root.breadcrumbs_title'),
      route  : 'users.albums_root',
      params : { user_hid: user.hid }
    });
  });
};
