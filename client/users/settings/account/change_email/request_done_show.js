// Move to change email page using code received in email
//
'use strict';


let view = null;


N.wire.on('navigate.preload:' + module.apiPath, function load_deps(preload) {
  preload.push('vendor.knockout');
});


// Page enter
//
N.wire.on('navigate.done:' + module.apiPath, function page_setup() {
  const ko = require('knockout');

  view = {
    error: ko.observable(null)
  };

  ko.applyBindings(view, $('#content')[0]);
});


// Setup listeners
//
N.wire.once('navigate.done:' + module.apiPath, function page_once() {

  // Page exit
  //
  N.wire.on('navigate.exit:' + module.apiPath, function page_exit() {
    const ko = require('knockout');

    ko.cleanNode($('#content')[0]);
    view = null;
  });


  // Form submit
  //
  N.wire.on(module.apiPath + ':submit', function submit_code(data) {

    return N.io.rpc('users.settings.account.change_email.change_show', data.fields)
      .then(res => {
        if (!res.valid_token) {
          view.error(t('err_invalid_token'));
          return;
        }

        return N.wire.emit('navigate.to', {
          apiPath: 'users.settings.account.change_email.change_show',
          params: data.fields
        });
      }, err => {
        // Non client error will be processed with default error handler
        if (err.code !== N.io.CLIENT_ERROR) throw err;

        view.error(err.message);
      });
  });
});
