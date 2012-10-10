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


/*global _, nodeca, window*/

var login_required_fields = [
  'email',
  'pass'
];


/**
 *  client.common.auth.login.plain.exec($form, event)
 *
 *  send login request
 **/
module.exports = function ($form) {
  var message;
  var params = nodeca.client.common.form.getData($form);

  var has_empty_fields = _.any(login_required_fields, function (field) {
    return _.isEmpty(params[field]);
  });

  // do minimal check prior to send data to server
  // all required fields must be filled
  if (has_empty_fields) {
    message = nodeca.runtime.t('users.auth.login_form.error.not_filled');
    nodeca.client.common.render.page('users.auth.login.show', {
      email: params.email,
      pass:  params.pass,
      errors: {
        common: message
      }
    });
    return false;
  }

  nodeca.server.users.auth.login.plain.exec(params, function (err) {

    if (err) {
      // failed login/password or captcha
      if (err.code === nodeca.io.BAD_REQUEST) {
        nodeca.client.common.render.page('users.auth.login.show', {
          email: params.email,
          pass:  params.pass,
          errors: err.message
        });
        return;
      }

      // something unexpected
      nodeca.client.common.notify('error', err.message);
      return;
    }

    window.location = nodeca.runtime.router.linkTo('users.profile');
  });

  // Disable regular click
  return false;
};
