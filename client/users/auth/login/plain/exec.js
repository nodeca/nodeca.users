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
 *  client.common.auth.login
 **/

/**
 *  client.common.auth.login.plain
 **/


/*global $, _, nodeca, window*/

var login_in_fields = [
  'email',
  'pass',
  'recaptcha_response_field'
];


/**
 *  client.common.auth.login.plain.exec($form, event)
 *
 *  send login request
 **/
module.exports = function ($form, event) {
  var message;
  var params = nodeca.client.common.form.getData($form);

  var has_empty_fields = _.any(login_in_fields, function(field) {
    return _.isEmpty(params[field]);
  });

  if (has_empty_fields) {
    message = nodeca.runtime.t('users.auth.login_form.error.not_filled');
    nodeca.client.common.render.page('users.auth.login.view', {
      email: params.email,
      error: message
    });
    return false;
  }

  nodeca.server.users.auth.login.plain.exec(params, function (err) {
    if (!!err) {
      message = _.values(err.message)[0];

      if (err.statusCode === 401) {
        nodeca.common.client.render.page('users.auth.login.view', {
          email: params.email,
          error: message
        });
        return;
      }

      message = nodeca.runtime.t('common.error.server_internal');
      nodeca.client.common.notice('error', message);
      return;
    }

    window.location = nodeca.runtime.router.linkTo('users.profile');
  });

  // Disable regular click
  return false;
};
