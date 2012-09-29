'use strict';


/**
 *  client
 **/

/**
 *  client.common
 **/

/**
 *  client.common.auth
 **/


/*global $, _, nodeca, window*/


/**
 *  client.common.auth.register($form, event)
 *
 *  send registration data on server
 **/
module.exports = function ($form, event) {
  var params = nodeca.client.common.form.getData($form);

  nodeca.server.users.auth.register.exec(params, function(err){
    var message;

    if (err) {
      if (err.statusCode === 409) {
        // clear pass
        params.pass = '';
        // add errors
        params.errors = err.message;
        $form.replaceWith(
          nodeca.client.common.render('users.auth.register.view', params)
        ).fadeIn();
        return;
      }
      message = nodeca.runtime.t('common.error.server_internal');
      nodeca.client.common.notice.show(message);
      return;
    }

    $form.replaceWith(
      nodeca.client.common.render('users.auth.register.success')
    ).fadeIn();
  });

  // Disable regular click
  return false;
};
