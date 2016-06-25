// Popup dialog to delete infraction
//
// options:
//
// - reason - out
//
'use strict';


const _ = require('lodash');


let $dialog;
let params;
let result;


N.wire.once(module.apiPath, function init_handlers() {

  // Submit button handler
  //
  N.wire.on(module.apiPath + ':submit', function submit_infraction_delete_dlg(form) {
    if ($.trim(form.fields.reason) !== '') {
      params.reason = form.fields.reason;
    }

    result = params;
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


// Init dialog
//
N.wire.on(module.apiPath, function show_infraction_delete_dlg(options) {
  params = options;
  $dialog = $(N.runtime.render(module.apiPath, _.assign({ apiPath: module.apiPath }, params)));

  $('body').append($dialog);

  return new Promise((resolve, reject) => {
    $dialog
      .on('shown.bs.modal', () => {
        $dialog.find('.btn-secondary').focus();
      })
      .on('hidden.bs.modal', () => {
        // When dialog closes - remove it from body and free resources
        $dialog.remove();
        $dialog = null;
        params = null;

        if (result) resolve();
        else reject('CANCELED');

        result = null;
      })
      .modal('show');
  });
});
