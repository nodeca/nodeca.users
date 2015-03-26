// About block
//

'use strict';

// Init about block
//
N.wire.once('navigate.done:users.member', function init_about() {

  // Init popovers
  $('.member-block__contacts-inline [data-toggle="popover"]').popover();
});
