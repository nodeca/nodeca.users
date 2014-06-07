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

  $dialog.modal('show');
});


// Listen submit button
//
N.wire.on('users.album.create:submit', function submit_album_create_dlg() {
  var title = $dialog.find('#create-album__title').val();

  N.io.rpc('users.album.create', { 'title': title }, function () {
    // Emit event on success
    N.wire.emit('users.album.create:done');
  });

  $dialog.modal('hide');
});


// Close dialog on sudden page exit (if user click back button in browser)
//
N.wire.on('navigate.exit', function teardown_page() {
  if ($dialog) {
    $dialog.modal('hide');
  }
});
