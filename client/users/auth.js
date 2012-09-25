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
 *  client.common.auth.login($form, event)
 *
 *  send login request
 **/
module.exports.login = function ($form, event) {
  var message;
  var params = nodeca.client.common.form.getData($form);

  var is_empty_fields = _.any(login_in_fields, function(field) {
    return _.isEmpty(params[field]);
  });
  if (is_empty_fields) {
    message = nodeca.runtime.t('users.auth.login_form.empty_fields');
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
      message = nodeca.runtime.t('common.notice.internal_server_error');
      nodeca.client.common.notice.show(message);
      return;
    }
    nodeca.client.common.history.navigateTo('users.profile');
  });
  return false;
};


/**
 *  client.common.auth.register($form, event)
 *
 *  send registration data on server
 **/
module.exports.register = function ($form, event) {
  var params = nodeca.client.common.form.getData($form);
  nodeca.server.users.auth.register.exec(params, function(err, request){
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
      message = nodeca.runtime.t('common.notice.internal_server_error');
      nodeca.client.common.notice.show(message);
      return;
    }
    $form.replaceWith(
      nodeca.client.common.render('users.auth.register.success')
    ).fadeIn();
  });
  return false;
};
