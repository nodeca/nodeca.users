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


/*global nodeca, _, $*/



/**
 *  client.admin.users.usergroups.update($elem, event)
 *
 * Update single field value.
 **/
module.exports = function ($form) {

  var params = nodeca.client.admin.form.getData($form);

  if (_.isEmpty(params.parent_group)) {
    delete(params.parent_group);
  }
  // get unchecked values
  $form.find("input:checkbox:not(:checked)").each(function() {
    params[$(this).attr('name')] = false;
  });


  nodeca.server.admin.users.usergroups.update(params, function (err) {
    if (err) {
      if (err.code === nodeca.io.BAD_REQUEST) {
        // add errors
        params.errors = err.data;
        nodeca.client.admin.render.page('admin.users.usergroups.create', params);
        return;
      }
      // no need for fatal errors notifications as it's done by io automagically
      nodeca.console.error(err);
    }
  });
  // Disable regular click
  return false;
};
