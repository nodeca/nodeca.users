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

    let settings = await env.extras.settings.fetch([
      'option_no_mlinks',
      'option_no_emojis',
      'option_no_quote_collapse',
      'option_breaks'
    ]);

    env.res.user_settings = {
      no_mlinks:         settings.option_no_mlinks,
      no_emojis:         settings.option_no_emojis,
      no_quote_collapse: settings.option_no_quote_collapse,
      breaks:            settings.option_breaks
    };
  });
};
