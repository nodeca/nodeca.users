// Popup dialog to create album


'use strict';


var $dialog;


// Init dialog on event
//
N.wire.on('users.album.create', function show_album_create_dlg() {
  $dialog = $(N.runtime.render('users.album.create'));

  $('body').append($dialog);

  // When dialog closes - remove it from body
  $dialog.on('hidden.bs.modal', function () {
    $dialog.remove();
    $dialog = null;
  });

  $dialog
    .on('shown.bs.modal', function () {
      $dialog.find('#album_name_dlg_input').focus();
    })
    .modal('show');
});


// Listen submit button
//
N.wire.on('users.album.create:submit', function submit_album_create_dlg(form) {
  var title = form.fields.album_name;

  // Don't allow empty name for albums
  if (!title || !$.trim(title)) {
    N.wire.emit('notify', t('err_empty_name'));
    return;
  }

  N.io.rpc('users.album.create', { 'title': title })
    .done(function () {
      $dialog.modal('hide');
      // Emit event on success
      N.wire.emit('users.album.create:done');
    })
    .fail(function () {
      $dialog.modal('hide');
    });
});


// Close dialog on sudden page exit (if user click back button in browser)
//
N.wire.on('navigate.exit', function teardown_page() {
  if ($dialog) {
    $dialog.modal('hide');
  }
});
