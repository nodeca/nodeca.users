// Popup dialog to add a user to ignore list
//
'use strict';


let $dialog;
let result;


N.wire.once(module.apiPath, function init_handlers() {
  // Add user to ignore list
  //
  N.wire.on(module.apiPath + ':submit', function submit_ignore_user_dlg(form) {
    result = form.fields;
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
N.wire.on(module.apiPath, function ignore_user_dlg(data) {
  let params = {
    apiPath: module.apiPath,
    user: data.$this.data('user')
  };

  result = null;

  $dialog = $(N.runtime.render(module.apiPath, params));
  $('body').append($dialog);

  return new Promise((resolve, reject) => {
    $dialog
      .on('shown.bs.modal', function () {
        $dialog.find('.btn-secondary').focus();
      })
      .on('hidden.bs.modal', function () {
        // When dialog closes - remove it from body and free resources.
        $dialog.remove();
        $dialog = null;
        params = null;

        if (!result) return reject('CANCELED');

        N.io.rpc('users.settings.ignore.add', {
          user:   result.user,
          period: Number(result.period) || 0,
          reason: result.reason
        }).then(resolve, reject);
      })
      .modal('show');
  });
});
