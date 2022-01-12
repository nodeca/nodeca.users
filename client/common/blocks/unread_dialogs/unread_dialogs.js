'use strict';


N.wire.once('navigate.done', function page_setup() {

  if (N.runtime.unread_dialogs === true) {
    // Pin class on <body> to make it persistent after page change
    $('body').addClass('navbar__m-unread-dialogs');
  }

  // Update unread dialogs indicator
  //
  N.live.on(`private.member.${N.runtime.user_id}.unread_dialogs`, function update_unread_dialogs_flag(new_state) {
    $('body').toggleClass('navbar__m-unread-dialogs', new_state.unread);
  });
});
