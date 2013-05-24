// Show after register intructions, i.e. 'activate your account'.


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function register_done(env) {
    env.response.data.head.title = env.helpers.t('users.auth.register.title');
  });
};
