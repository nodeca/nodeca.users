/**
 * Toggle control group highlight.
 * Also if override off then reset settings value to inherited
 **/


'use strict';


N.wire.on(module.apiPath, function usergroup_override_toggele(event) {
  var $elem        = $(event.currentTarget)
    , setting_name = $elem.attr('id').replace('so_', '');

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
});
