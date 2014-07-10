// Popup dialog to create album


'use strict';

var $dialog;
var params;
var doneCallback;


// Init dialog on event
//
N.wire.on('users.album.create_medialink', function show_create_medialink_dlg(data, callback) {
  params = data;
  doneCallback = callback;
  $dialog = $(N.runtime.render('users.album.create_medialink', { providers: params.providers }));

  $('body').append($dialog);

  // When dialog closes - remove it from body
  $dialog.on('hidden.bs.modal', function () {
    $dialog.remove();
    $dialog = null;
    doneCallback = null;
  });

  $dialog.modal('show');
});


// Listen submit button
//
N.wire.on('users.album.create_medialink:submit', function submit_create_medialink_dlg(form) {
  N.io.rpc('users.media.create_medialink', { album_id: params.album_id, media_url: form.fields.media_url })
    .done(function () {
      $dialog.modal('hide');

      doneCallback();
    });
});


// Close dialog on sudden page exit (if user click back button in browser)
//
N.wire.on('navigate.exit', function teardown_page() {
  if ($dialog) {
    $dialog.modal('hide');
  }
});
