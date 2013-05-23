// Logout


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function (env, callback) {
    env.session = null;

    N.settings.get('auth_logout_redirect_url', {}, function (err, url) {
      if (err) {
        callback(err);
        return;
      }

      env.response.data.redirect_url = url;
      callback();
    });
  });
};
