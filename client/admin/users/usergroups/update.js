'use strict';


/**
 *  client
 **/

/**
 *  client.admin
 **/

/**
 *  client.admin.users
 **/


/**
 *  client.admin.users.usergroups
 **/

/**
 *  client.admin.users.usergroups.update
 **/


/*global nodeca, _*/

var white_list = ['_id','parent'];
var params_mask = 's_';

/**
 *  client.admin.users.usergroups.update($elem, event)
 *
 * Update single field value.
 **/
module.exports = function ($form) {
  var data = nodeca.client.admin.form.getData($form);
  var params = {};

  if (_.isEmpty(data.parent)) {
    delete(data.parent);
  }

  _.keys(data).forEach(function(key) {
    if (key.indexOf(params_mask) === 0) {
      params[key.replace(params_mask, '')] = data[key];
      return;
    }
    if (white_list.indexOf(key) !== -1) {
      params[key] = data[key];
    }
  });

  nodeca.server.admin.users.usergroups.update(params, function (err) {
    if (err) {
      if (err.code === nodeca.io.BAD_REQUEST) {
        // add errors
        nodeca.client.admin.notify('error', err.data.common);
        return;
      }
      // no need for fatal errors notifications as it's done by io automagically
      nodeca.logger.error(err);
      return;
    }
    nodeca.client.admin.notify('info', nodeca.runtime.t('admin.users.usergroups.edit.saved'));
  });
  // Disable regular click
  return false;
};
