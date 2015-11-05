'use strict';

N.wire.on('navigate.done:' + module.apiPath, function nav_tracker_tab_activate() {
  $('.navbar').find('[data-api-path="users.tracker"]').addClass('active');
});
