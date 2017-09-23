// Store the preference locale in cookies and (if user authorized) DB
// to use on next requests.
//
'use strict';


const _ = require('lodash');


const LOCALE_COOKIE_MAX_AGE = 0xFFFFFFFF; // Maximum 32-bit unsigned integer.


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    locale: { type: 'string' }
  });

  N.wire.on(apiPath, async function set_language(env) {
    var locale = env.params.locale;

    if (!_.includes(N.config.locales, env.params.locale)) {
      // User sent a non-existent or disabled locale - reply with the default.
      locale = N.config.locales[0];
    }

    env.extras.setCookie('locale', locale, {
      path: '/',
      maxAge: LOCALE_COOKIE_MAX_AGE
    });

    env.user_info.locale = locale;

    if (!env.user_info.user_id) return;

    await N.models.users.User.update({ _id: env.user_info.user_id }, { locale });
  });
};
