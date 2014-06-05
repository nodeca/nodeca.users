'use strict';


module.exports = function (N, apiPath) {
  var User = N.models.users.User;

  N.validate(apiPath, {});


  // Check auth
  //
  N.wire.before(apiPath, function check_user_auth(env) {
    if (env.user_info.is_guest) {
      return N.io.NOT_AUTHORIZED;
    }
  });


  // Get current user hid and redirect to albums page
  //
  N.wire.on(apiPath, function redirect_to_albums(env, callback) {
    User.findOne({ '_id': env.session.user_id }, function (err, user) {
      if (err) {
        callback(err);
      }

      callback({
        code: N.io.REDIRECT,
        head: {
          'Location': N.runtime.router.linkTo('users.member', { 'user_hid': user.hid })
        }
      });
    });
  });
};
