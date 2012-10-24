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
  var params = { _id: $elem.attr('id') };

  nodeca.server.admin.users.usergroups.remove(params, function (err) {
    if (err) {
      // no need for fatal errors notifications as it's done by io automagically
      nodeca.console.error(err);
    }

    window.location = nodeca.runtime.router.linkTo('admin.users.usergroups.index');
  });

  // Disable regular click
  return false;
};
