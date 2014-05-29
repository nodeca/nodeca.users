'use strict';

var $dialog;


N.wire.on('users.member.albums.create_album', function show_album_create_dlg() {
  $dialog = $(N.runtime.render('users.blocks.albums_create'));

  $('body').append($dialog);

  // When dialog closes - remove it from body
  $dialog.on('hidden.bs.modal', function () {
    $dialog.remove();
    $dialog = null;
  });

  $dialog.modal('show');
});


N.wire.on('users.blocks.albums_create_submit', function submit_album_create_dlg() {
  var title = $dialog.find('#create-album__title').val();

  N.io.rpc('users.member.albums.create', { 'title': title }, function () {
    // TODO: make it better
    window.location.reload();
  });

  $dialog.modal('hide');
});


// Close dialog if user click back button in browser
//
N.wire.on('navigate.exit', function teardown_page() {
  if ($dialog) {
    $dialog.modal('hide');
  }
});
