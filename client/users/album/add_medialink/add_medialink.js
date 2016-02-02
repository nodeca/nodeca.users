// Popup dialog to create album
//
// params
//
// - album_id
// - providers - array of objects
//   - home - home page address
//   - name - displayable name
// - media_url - null. Will be filled after add
//
'use strict';


let $dialog;
let params;
let result;


// Init dialog on event
//
N.wire.on(module.apiPath, function show_add_medialink_dlg(data) {
  params = data;
  $dialog = $(N.runtime.render('users.album.add_medialink', { providers: params.providers }));

  $('body').append($dialog);

  return new Promise((resolve, reject) => {
    $dialog
      .on('hidden.bs.modal', function () {
        // When dialog closes - remove it from body
        $dialog.remove();
        $dialog = null;

        if (result) resolve(result);
        else reject('CANCELED');

        result = null;
      })
      .on('shown.bs.modal', function () {
        $dialog.find('#add-medialink__url').focus();
      })
      .modal('show');
  });
});


// Listen submit button
//
N.wire.on(module.apiPath + ':submit', function submit_add_medialink_dlg(form) {
  result = params.media_url = form.fields.media_url;
  $dialog.modal('hide');
});


// Close dialog on sudden page exit (if user click back button in browser)
//
N.wire.on('navigate.exit', function teardown_page() {
  if ($dialog) {
    $dialog.modal('hide');
  }
});
