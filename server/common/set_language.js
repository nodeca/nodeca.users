// Store the preference locale in cookies and (if available) session to use
// on next requests.


'use strict';


var _ = require('lodash');


var LOCALE_COOKIE_MAX_AGE = 0xFFFFFFFF; // Maximum 32-bit unsigned integer.


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    locale: { type: 'string' }
  });

  N.wire.on(apiPath, function set_language(env, callback) {
    var locale = env.params.locale;

    if (!_.includes(N.config.locales, env.params.locale)) {
      // User sent a non-existent or disabled locale - reply with the default.
      locale = N.config.locales[0];
    }

    env.extras.setCookie('locale', locale, {
      path: '/',
      maxAge: LOCALE_COOKIE_MAX_AGE
    });

    if (env.session) {
      env.session.locale = locale;
    }

    env.user_info.locale = locale;

    if (!env.user_info.user_id) {
      callback();
      return;
    }

    N.models.users.User.update({ _id: env.user_info.user_id }, { locale: locale }, callback);
  });
};
