// Popup dialog to create album


'use strict';


var getFormData = require('nodeca.core/lib/client/get_form_data');


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
N.wire.on('users.album.create:submit', function submit_album_create_dlg(event) {
  var title = getFormData($(event.currentTarget)).album_name;

  // Don't allow empty name for albums
  if (!title || !$.trim(title)) {
    N.wire.emit('notify', t('err_empty_name'));
    return;
  }

  N.io.rpc('users.album.create', { 'title': title }, function (err) {
    $dialog.modal('hide');

    if (err) { return false; }

    // Emit event on success
    N.wire.emit('users.album.create:done');
  });

});


// Close dialog on sudden page exit (if user click back button in browser)
//
N.wire.on('navigate.exit', function teardown_page() {
  if ($dialog) {
    $dialog.modal('hide');
  }
});
