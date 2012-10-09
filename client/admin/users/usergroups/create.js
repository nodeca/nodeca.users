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


/*global nodeca, window*/


/**
 *  client.admin.users.usergroups.create($form, event)
 *
 * collect new group data from form and send on server
 **/
module.exports = function ($form) {
  var params = nodeca.client.admin.form.getData($form);
  nodeca.server.admin.users.usergroups.create(params, function(err){
    if (err) {
      // Wrong form params - regenerate page with hightlighted errors
      if (err.statusCode === nodeca.io.BAD_REQUEST) {
        // add errors
        params.errors = err.message;
        nodeca.client.admin.render.page('admin.users.usergroups.create', params);
        return;
      }

      // something fatal
      nodeca.client.admin.notify('error', err.message);
      return;
    }

    window.location = nodeca.runtime.router.linkTo('admin.users.usergroups.index');
  });

  // Disable regular click
  return false;
};
