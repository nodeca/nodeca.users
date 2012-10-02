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

/**
 *  client.common.auth.register
 **/


/*global nodeca, window*/


/**
 *  client.common.auth.register.exec($form, event)
 *
 *  send registration data on server
 **/
module.exports = function ($form, event) {
  var params = nodeca.client.common.form.getData($form);

  nodeca.server.users.auth.register.exec(params, function(err){
    if (err) {
      // Wrong form params - regenerate page with hightlighted errors
      if (err.statusCode === nodeca.io.BAD_REQUEST) {
        // add errors
        params.errors = err.message;
        nodeca.client.common.render.page('users.auth.register.view', params);
        return;
      }

      // something fatal
      nodeca.client.common.notify('error', err.message);
      return;
    }

    window.location = nodeca.runtime.router.linkTo('users.auth.register.success');
  });

  // Disable regular click
  return false;
};
