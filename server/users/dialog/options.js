// Fill parse options for messages
//
'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});


  // Check user permission
  //
  N.wire.before(apiPath, function check_permissions(env) {
    if (env.user_info.is_guest) {
      return N.io.NOT_FOUND;
    }
  });


  // Fill parse options
  //
  N.wire.on(apiPath, function* fill_parse_options(env) {
    env.res.parse_options = yield N.settings.getByCategory(
      'messages_markup',
      { usergroup_ids: env.user_info.usergroups },
      { alias: true }
    );
  });
};
