// Popup dialog to edit media


'use strict';

var $dialog;
var params;
var doneCallback;
var data;


// Load media info and user albums list
//
N.wire.before('users.media.edit', function load_media_info(options, callback) {
  params = options;

  N.io.rpc('users.media.edit', params).done(function (mediaInfo) {
    data = mediaInfo;
    callback();
  });
});


// Init dialog
//
N.wire.on('users.media.edit', function show_media_edit_dlg(options, callback) {
  doneCallback = callback;
  $dialog = $(N.runtime.render('users.media.edit', data));

  $('body').append($dialog);

  // When dialog closes - remove it from body
  $dialog.on('hidden.bs.modal', function () {
    $dialog.remove();
    $dialog = null;
    doneCallback = null;
    params = null;
  });

  $dialog.modal('show');
});


// Listen submit button
//
N.wire.on('users.media.edit:submit', function submit_media_edit_dlg(form) {
  N.io.rpc('users.media.update', { media_id: params.media_id, album_id: form.fields.album_id })
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
