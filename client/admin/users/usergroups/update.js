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
        params.errors = err.data;
        nodeca.client.admin.render.page('admin.users.usergroups.edit', params);
        return;
      }
      // no need for fatal errors notifications as it's done by io automagically
      nodeca.console.error(err);
    }

    window.location = nodeca.runtime.router.linkTo('admin.users.usergroups.index');
  });
  // Disable regular click
  return false;
};
