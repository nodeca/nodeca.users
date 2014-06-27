// Show form with email and captcha to request password reset.


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});


  N.wire.before(apiPath, function rquest_pass_guest_only(env, callback) {
    N.wire.emit('internal:users.redirect_not_guest', env, callback);
  });


  N.wire.on(apiPath, function fill_page_head(env) {
    env.res.head.title = env.t('title');
  });
};
