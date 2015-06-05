// Reload page on `local.users.auth.logout` and `local.users.auth.login` message after delay
//
'use strict';


N.wire.once('navigate.done', function login_logout_reload_init() {
  N.live.on('local.users.auth.logout', function logout_reload() {
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


  N.live.on('local.users.auth.login', function login_reload() {
    var $reloadDialog = $(N.runtime.render('common.blocks.navbar_auth.reload_after_login_dlg'));

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
