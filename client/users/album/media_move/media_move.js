// Popup dialog to edit media


'use strict';

let $dialog;
let params;
let doneCallback;
let data;


// Load media info and user albums list
//
N.wire.before(module.apiPath, function load_media_info(options) {
  params = options;

  return N.io.rpc('users.album.media_move.get_albums').then(function (mediaInfo) {
    data = mediaInfo;
  });
});


// Init dialog
//
N.wire.on(module.apiPath, function show_media_edit_dlg(options, callback) {
  doneCallback = callback;
  $dialog = $(N.runtime.render(module.apiPath, {
    current_album_id: params.src_album,
    albums: data.albums
  }));

  $('body').append($dialog);

  // When dialog closes - remove it from body
  $dialog
    .on('hidden.bs.modal', function () {
      $dialog.remove();
      $dialog = null;
      doneCallback = null;
      params = null;
    })
    .modal('show');
});


// Listen submit button
//
N.wire.on(module.apiPath + ':submit', function submit_media_edit_dlg(data) {
  N.io.rpc('users.album.media_move.update', {
    media_ids: params.media_ids,
    src_album: params.src_album,
    dst_album: data.fields.album_id
  })
    .then(function () {
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
