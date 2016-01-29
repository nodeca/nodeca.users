// Popup dialog to create album
//
// - params
//   - album - output. `null` if canceled
// - callback
//
'use strict';


var $dialog;
var album;


N.wire.once('users.album.create', function init_event_handlers() {

  // Listen submit button
  //
  N.wire.on('users.album.create:submit', function submit_album_create_dlg(form) {
    var title = form.fields.album_name;

    // Don't allow empty name for albums
    if (!title || !$.trim(title)) {
      N.wire.emit('notify', t('err_empty_name'));
      return;
    }

    N.io.rpc('users.album.create', { title })
      .then(function (res) {
        album = res.album;
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
});


// Init dialog on event
//
N.wire.on('users.album.create', function show_album_create_dlg(params, callback) {
  $dialog = $(N.runtime.render('users.album.create'));
  params.album = null;

  $('body').append($dialog);

  // When dialog closes - remove it from body
  $dialog.on('hidden.bs.modal', function () {
    params.album = album;
    callback();

    $dialog.remove();
    $dialog = null;
    album = null;
  });

  $dialog
    .on('shown.bs.modal', function () {
      $dialog.find('#album_name_dlg_input').focus();
      N.wire.emit('users.album.create:shown');
    })
    .modal('show');
});
