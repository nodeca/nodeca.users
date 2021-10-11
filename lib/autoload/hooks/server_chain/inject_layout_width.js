// User may override layout width in settings, inject new value
//

'use strict';


module.exports = function (N) {

  N.wire.after('server_chain:http:*', async function inject_layout_width(env) {
    let layout_max_width = Number(await env.extras.settings.fetch('layout_max_width'));
    let setting = N.config.setting_schemas.user.layout_max_width;

    if (layout_max_width && layout_max_width !== setting.default &&
       (!setting.min || layout_max_width >= setting.min)) {

      env.inject_headers = env.inject_headers || [];
      env.inject_headers.push(
        `<style>.layout__container { max-width: ${layout_max_width}px; }</style>`
      );
    }
  });
};
