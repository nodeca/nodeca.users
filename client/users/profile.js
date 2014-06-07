// Check N.runtime.page_data.profile_tab & highlight topbar tab if true


'use strict';


// Should run after global highlighter
N.wire.after('navigate.done', function setup_page() {
  var profileTab = $('.nav-horiz').find('[data-api-path="users.profile_redirect"]');

  if (N.runtime.page_data.profile_tab) {
    profileTab.addClass('active');
  }
});
