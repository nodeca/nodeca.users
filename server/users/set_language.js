// Store the preference locale in cookies and (if available) session to use
// on next requests.


'use strict';


var LOCALE_COOKIE_MAX_AGE = 0xFFFFFFFF; // Maximum 32-bit unsigned integer.


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    locale: {
      type: 'string'
    , enum: N.config.locales.enabled
    }
  });

  N.wire.on(apiPath, function set_language(env, callback) {
    env.extras.setCookie('locale', env.params.locale, {
      path: '/'
    , maxAge: LOCALE_COOKIE_MAX_AGE
    });

    if (env.session) {
      env.session.locale = env.params.locale;
    }

    if (env.session && env.session.user_id) {
      N.models.users.User.findById(env.session.user_id, function (err, user) {
        if (err) {
          callback(err);
          return;
        }

        user.locale = env.params.locale;
        user.save(callback);
      });
    } else {
      callback();
    }
  });
};
