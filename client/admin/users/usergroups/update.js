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
 *  client.admin.usergroups.update
 **/


/*global nodeca*/

var DELAY = 500;

var timeout;

/**
 *  client.admin.usergroups.update($elem, event)
 *
 * Update single field value.
 **/
module.exports = function ($elem) {
  // make sure previous timeout was cleared
  clearTimeout(timeout);

  // delay request
  timeout = setTimeout(function() {
    var params = {
      _id: $elem.parents('form').find('input#_id').val()
    };
    params[$elem.attr('name')] = $elem.val();
    nodeca.server.admin.users.usergroups.update(params, function(err){
      if (err) {
        // something fatal
        // FIXME highlight red
        nodeca.client.admin.notify('error', err.message);
        return;
      }

      // no errors
      // FIXME highlight green
    });
  }, DELAY);
  return false;
};
