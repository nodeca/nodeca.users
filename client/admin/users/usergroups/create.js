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
 *  client.admin.users.usergroups.create
 **/


/*global nodeca, window, _*/


/**
 *  client.admin.users.usergroups.create($form, event)
 *
 * collect new group data from form and send on server
 **/
module.exports = function ($form) {
  var params = nodeca.client.admin.form.getData($form);

  if (_.isEmpty(params.parent_group)) {
    delete(params.parent_group);
  }
  nodeca.server.admin.users.usergroups.create(params, function (err) {
    if (err) {
      // Wrong form params - regenerate page with hightlighted errors
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
