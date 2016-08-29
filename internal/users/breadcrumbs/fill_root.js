'use strict';

module.exports = function (N, apiPath) {


  // Fill user name
  //
  N.wire.on(apiPath, function fill_user_name(env) {
    var user = env.data.user;
    env.data.breadcrumbs = env.data.breadcrumbs || [];

    env.data.breadcrumbs.push({
      //text        : env.user_info.is_member ? user.name : user.nick,
      text        : user.nick,
      route       : 'users.member',
      params      : { user_hid: user.hid },
      user_id     : user._id,
      avatar_id   : env.user_info.is_member ? user.avatar_id : null,
      show_avatar : true
    });
  });
};
