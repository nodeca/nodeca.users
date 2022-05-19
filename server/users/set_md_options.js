// Save options if user changed anything in markdown editor
//
'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    no_mlinks:         { type: 'boolean', required: true },
    no_emojis:         { type: 'boolean', required: true },
    no_quote_collapse: { type: 'boolean', required: true },
    breaks:            { type: 'boolean', required: true }
  });


  N.wire.on(apiPath, async function save_user_options(env) {
    if (!env.user_info.is_member) return N.io.NOT_FOUND;

    let new_opts = {
      option_no_mlinks:         env.params.no_mlinks,
      option_no_emojis:         env.params.no_emojis,
      option_no_quote_collapse: env.params.no_quote_collapse,
      option_breaks:            env.params.breaks
    };

    let keys = Object.keys(new_opts);
    let old_opts = await env.extras.settings.fetch(keys);
    let settings = {};

    for (let k of keys) {
      if (old_opts[k] !== new_opts[k]) {
        settings[k] = { value: new_opts[k] };
      }
    }

    if (Object.keys(settings).length) {
      await N.settings.getStore('user').set(settings, { user_id: env.user_info.user_id });
    }
  });
};
