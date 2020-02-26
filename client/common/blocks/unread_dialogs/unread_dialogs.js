'use strict';


N.wire.once('navigate.done', function page_setup() {

  if (N.runtime.unread_dialogs === true) {
    $('.navbar').addClass('navbar__m-unread-dialogs');
  }

  // Update unread dialogs indicator
  //
  N.live.on(`private.member.${N.runtime.user_id}.unread_dialogs`, function update_unread_dialogs_flag(new_state) {
    $('.navbar').toggleClass('navbar__m-unread-dialogs', new_state);
  });
});
