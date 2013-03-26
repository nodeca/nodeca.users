/**
 * Update single field value.
 **/


'use strict';


/*global N, t, window*/


var _           = require('lodash');
var $           = window.jQuery;
var notify      = require('nodeca.core/client/admin/_notify');
var getFormData = require('nodeca.core/client/admin/_get_form_data');


var white_list = ['_id','parent'];
var params_mask = 's_';


N.wire.on(module.apiPath, function usergroup_edit(event) {
  var $form  = $(event.currentTarget)
    , data   = getFormData($form)
    , params = {};

  if (_.isEmpty(data.parent)) {
    delete(data.parent);
  }

  _.keys(data).forEach(function(key) {
    if (0 === key.indexOf(params_mask)) {
      params[key.replace(params_mask, '')] = data[key];

    } else if (-1 !== white_list.indexOf(key)) {
      params[key] = data[key];
    }
  });

  N.io.rpc('admin.users.usergroups.update', params, function (err) {
    if (err) {
      if (N.io.BAD_REQUEST === err.code) {
        // add errors
        notify('error', err.data.common);
      } else {
        // no need for fatal errors notifications as it's done by io automagically
        N.logger.error(err);
      }
    } else {
      notify('info', t('saved'));
    }
  });
});
