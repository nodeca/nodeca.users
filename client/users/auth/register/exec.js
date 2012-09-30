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


/*global $, _, nodeca, window*/


/**
 *  client.common.auth.register.exec($form, event)
 *
 *  send registration data on server
 **/
module.exports = function ($form, event) {
  var params = nodeca.client.common.form.getData($form);

  nodeca.server.users.auth.register.exec(params, function(err){
    var message;

    if (err) {
      if (err.statusCode === 409) {
        // add errors
        params.errors = err.message;
        nodeca.client.common.render.page('users.auth.register.view', params);
        return;
      }
      message = nodeca.runtime.t('common.error.server_internal');
      nodeca.client.common.notice('error', message);
      return;
    }

    nodeca.client.common.render.page('users.auth.register.success');
  });

  // Disable regular click
  return false;
};
