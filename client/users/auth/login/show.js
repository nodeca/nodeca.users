/**
 *  Send login request.
 **/


'use strict';


/*global N, t, window*/


var _ = require('lodash');
var $ = window.jQuery;
var getFormData = require('nodeca.core/client/common/_get_form_data');


var login_required_fields = [
  'email'
, 'pass'
];


N.wire.on(module.apiPath, function login(event) {
  var $form  = $(event.currentTarget)
    , params = getFormData($form);

  var has_empty_fields = _.any(login_required_fields, function (field) {
    return _.isEmpty(params[field]);
  });

  // do minimal check prior to send data to server
  // all required fields must be filled
  if (has_empty_fields) {
    params.errors = {
      common: t('not_filled')
    };

    $('#content').replaceWith(N.runtime.render(module.apiPath, params));
    return;
  }

  N.io.rpc('users.auth.login.exec', params, function (err) {
    if (err) {
      if (N.io.BAD_REQUEST === err.code) {
        // failed login/password or captcha
        params.errors = err.data;
        $('#content').replaceWith(N.runtime.render(module.apiPath, params));
      } else {
        // no need for fatal errors notifications as it's done by io automagically
        N.logger.error(err);
      }
    } else {
      window.location = N.runtime.router.linkTo('users.profile');
    }
  });
});
