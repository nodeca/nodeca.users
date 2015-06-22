'use strict';


N.wire.once('navigate.done', function page_setup() {

  // Reload page on `local.users.auth` message after delay
  //
  N.live.on('local.users.auth', function logout_reload() {
    // Automatically reload after 2 sec
    setTimeout(function () {
      window.location.reload();
    }, 2000);
  });


  // Update avatar in navbar
  //
  N.live.on('local.users.avatar.change', function update_avatar(avatarId) {
    N.runtime.user_avatar = avatarId;

    var $img = $('.navbar-auth__avatar');
    var avatarAttrs = N.runtime.render.helpers.avatar(N.runtime.user_id, 'md');

    Object.keys(avatarAttrs).forEach(function (name) {
      $img.attr(name, avatarAttrs[name]);
    });
  });
});
