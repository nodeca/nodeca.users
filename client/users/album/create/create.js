// Popup dialog to create album
//
// - params
//   - title - out
//
'use strict';


let $dialog;
let params;
let result;


N.wire.once(module.apiPath, function init_event_handlers() {

  // Listen submit button
  //
  N.wire.on(module.apiPath + ':submit', function submit_album_create_dlg(form) {
    let title = form.fields.album_name;

    // Don't allow empty name for albums
    if (!title || !$.trim(title)) {
      N.wire.emit('notify', t('err_empty_name'));
      return;
    }

    params.title = result = title;
    $dialog.modal('hide');
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
N.wire.on(module.apiPath, function show_album_create_dlg(data) {
  params = data;
  $dialog = $(N.runtime.render('users.album.create'));

  $('body').append($dialog);

  return new Promise((resolve, reject) => {
    $dialog
      .on('hidden.bs.modal', () => {
        // When dialog closes - remove it from body
        $dialog.remove();
        $dialog = null;
        params = null;

        if (result) resolve(result);
        else reject('CANCELED');

        result = null;
      })
      .on('shown.bs.modal', () => {
        $dialog.find('#album_name_dlg_input').focus();
        N.wire.emit('users.album.create:shown');
      })
      .modal('show');
  });
});
