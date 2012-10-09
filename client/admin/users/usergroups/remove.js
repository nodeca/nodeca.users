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
 *  client.admin.users.usergroups.remove
 **/

/*global nodeca, window*/

/**
 *  client.admin.users.usergroups.remove($elem, event)
 *
 **/
module.exports = function ($elem) {
  var params = { short_name: $elem.attr('id') };
  nodeca.server.admin.users.usergroups.remove(params, function(err){
    if (err) {
      // something wrong
      nodeca.client.admin.notify('error', err.message);
      return;
    }
  });

  window.location = nodeca.runtime.router.linkTo('admin.users.usergroups.index');

  // Disable regular click
  return false;
};
