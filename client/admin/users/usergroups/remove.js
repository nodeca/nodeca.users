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

/*global confirm, nodeca, window*/

/**
 *  client.admin.users.usergroups.remove($elem, event)
 *
 **/
module.exports = function ($elem) {
  var params = { _id: $elem.attr('data-usergroup-id') };

  nodeca.server.admin.users.usergroups.remove(params, function (err) {
    if (err) {
      // something non fatal error
      if (err.code === nodeca.io.BAD_REQUEST) {
        nodeca.client.admin.notify('error', err.data.common);
        return;
      }
      // no need for fatal errors notifications as it's done by io automagically
      nodeca.logger.error(err);
      return;
    }

    window.location = nodeca.runtime.router.linkTo('admin.users.usergroups.index');
  });

  // Disable regular click
  return false;
};
