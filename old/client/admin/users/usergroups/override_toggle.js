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
 *  client.admin.users.usergroups.override_toogle
 **/


/*global $*/


/**
 *  client.admin.users.usergroups.override_toogle($elem, event)
 *
 * Toggle control group highlight.
 * Also if override off then reset settings value to inherited
 **/
module.exports = function ($elem) {
  var setting_name = $elem.attr('id').replace('so_', '');
  if ($elem.is(':checked')) {
    // toggle controll group class to overriden
    $('div#cg_' + setting_name).addClass('overriden');
    $('div#cg_' + setting_name).removeClass('inherited');
  }
  else {
    // FIXME Ask server inherited setting value

    // toggle control group class to inherited
    $('div#cg_' + setting_name).addClass('inherited');
    $('div#cg_' + setting_name).removeClass('overriden');
  }
  // Disable regular click
  return false;
};
