'use strict';


/**
 *  client
 **/

/**
 *  client.admin
 **/

/**
 *  client.admin.usergroups
 **/

/**
 *  client.admin.usergroups.delete
 **/

/*global nodeca, window*/

/**
 *  client.admin.usergroups.delete($elem, event)
 *
 **/
module.exports = function ($elem) {
  var params = { short_name: $elem.attr('id') };
  nodeca.server.admin.users.usergroups.delete(params, function(err){
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
