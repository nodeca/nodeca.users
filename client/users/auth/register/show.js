/**
 *  Send registration data on server.
 **/


'use strict';


var getFormData = require('nodeca.core/lib/client/get_form_data');


N.wire.on(module.apiPath, function register(event) {
  var $form  = $(event.currentTarget)
    , params = getFormData($form);

  N.io.rpc('users.auth.register.exec', params, function (err) {
    if (err) {
      // Wrong form params - regenerate page with hightlighted errors
      if (N.io.BAD_REQUEST === err.code) {
        // add errors
        params.errors = err.data;
        $('#content').replaceWith(N.runtime.render(module.apiPath, params));
      } else {
        // no need for fatal errors notifications as it's done by io automagically
        N.logger.error(err);
      }
      return;
    }

    window.location = N.runtime.router.linkTo('users.auth.register.success');
  });
});
