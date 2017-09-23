// Fill parse options for dialogs
//
'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});


  // Check user permission
  //
  N.wire.before(apiPath, function check_permissions(env) {
    if (!env.user_info.is_member) {
      return N.io.NOT_FOUND;
    }
  });


  // Fill parse options
  //
  N.wire.on(apiPath, async function fill_parse_options(env) {
    env.res.parse_options = await N.settings.getByCategory(
      'dialogs_markup',
      { usergroup_ids: env.user_info.usergroups },
      { alias: true }
    );
  });
};
