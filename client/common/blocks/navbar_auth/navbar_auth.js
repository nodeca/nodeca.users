'use strict';


N.wire.once('navigate.done', function page_setup() {

  // Update avatar in navbar
  //
  N.broadcast.on('local.users.avatar.change', function update_avatar(avatarId) {
    N.runtime.user_avatar = avatarId;

    var $img = $('.navbar-auth__avatar');
    var avatarAttrs = N.runtime.render.helpers.avatar(N.runtime.user_id, 'md');

    Object.keys(avatarAttrs).forEach(function (name) {
      $img.attr(name, avatarAttrs[name]);
    });
  });
});
