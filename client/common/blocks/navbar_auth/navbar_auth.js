// Reload page on `users.private.logout` message after delay
//
'use strict';

N.wire.once('navigate.done', function () {
  if (N.runtime.is_guest) {
    return;
  }

  N.live.on('remote.users.private.logout.' + N.runtime.user_id, function () {
    var $reloadDialog = $(N.runtime.render('common.blocks.navbar_auth.reload_after_logout_dlg'));

    $('body').append($reloadDialog);
    $reloadDialog.modal('show');

    // Reload page when dialog closes
    $reloadDialog.on('hidden.bs.modal', function () {
      window.location.reload();
    });

    // Automatically reload after 5 sec
    setTimeout(function () {
      window.location.reload();
    }, 5000);
  });
});
