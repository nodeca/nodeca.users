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


// rebuild_login_form(elem, params) -> Void
// - elem (Object): form DOM element
// - params (Object): render template params
//
// rebuild form after some error
//
function rebuild_login_form(elem, params) {
  elem.replaceWith(
    nodeca.client.common.render('users.auth.login.view', params)
  ).fadeIn();
}


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
    rebuild_login_form($form, {email: params.email, error: message});
    return false;
  }

  nodeca.server.users.auth.login.plain.exec(params, function (err) {
    if (!!err) {
      message = _.values(err.message)[0];

      if (err.statusCode === 401) {
        rebuild_login_form($form, {email: params.email, error: message});
        return;
      }

      message = nodeca.runtime.t('common.error.server_internal');
      nodeca.client.common.notice('error', message);
      return;
    }

    nodeca.client.common.history.navigateTo('users.profile');
  });

  // Disable regular click
  return false;
};
