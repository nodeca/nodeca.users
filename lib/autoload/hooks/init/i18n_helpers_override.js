// Override translation helpers to get locale info from `env.user_info.locale`
// instead of default `env.runtime.locale`
//

'use strict';


module.exports = function (N) {
  var helpers = require('nodeca.core/lib/system/env').helpers;

  helpers.t = function translate_helper(phrase, params) {
    // `this` is env in helpers
    var locale = this.user_info.locale || N.config.locales.enabled[0];

    return N.i18n.t(locale, phrase, params);
  };

  helpers.t_exists = function translate_exists_helper(phrase) {
    // `this` is env in helpers
    var locale = this.user_info.locale || N.config.locales.enabled[0];

    return N.i18n.hasPhrase(locale, phrase);
  };
};
