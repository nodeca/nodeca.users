// Render registration form


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});


  N.wire.before(apiPath, function register_guest_only(env, callback) {
    N.wire.emit('internal:users.redirect_not_guest', env, callback);
  });


  N.wire.on(apiPath, function fill_page_head(env) {
    env.res.head.title = env.t('title');
  });
};
