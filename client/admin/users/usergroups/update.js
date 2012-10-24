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


/*global nodeca, window, _, $*/



/**
 *  client.admin.users.usergroups.update($elem, event)
 *
 * Update single field value.
 **/
module.exports = function ($form) {

  var params = nodeca.client.admin.form.getData($form);

  if (_.isEmpty(params.parent)) {
    delete(params.parent);
  }

  nodeca.server.admin.users.usergroups.update(params, function (err) {
    if (err) {
      if (err.code === nodeca.io.BAD_REQUEST) {
        // add errors
        nodeca.client.admin.notify('error', err.data.common);
        return;
      }
      // no need for fatal errors notifications as it's done by io automagically
      nodeca.console.error(err);
      return;
    }
    nodeca.client.admin.notify('info', nodeca.runtime.t('admin.users.usergroups.edit.saved'));
  });
  // Disable regular click
  return false;
};
