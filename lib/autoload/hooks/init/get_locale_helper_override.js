// Override `.getLocale()` helper to get locale info from `env.user_info.locale`
// instead of default if available
//
'use strict';


module.exports = function () {
  require('nodeca.core/lib/system/env').initHandlers.push(env => {
    let defaultGetLocale = env.helpers.getLocale;

    env.helpers.getLocale = function () {
      if (env.user_info.locale) return env.user_info.locale;
      return defaultGetLocale();
    };
  });
};
