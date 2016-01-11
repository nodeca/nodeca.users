// Creates user and AuthLinks.
// Expects env.data to be filled with:
//
//   reg_info:
//     nick
//     email
//     pass
//   oauth_info:
//     ... # If oauth used, the same hash as AuthLink schema
//


'use strict';


module.exports = function (N, apiPath) {


  // On error destroy created User, AuthLink, and pass `err` to `callback`.
  //
  function fail(user_id, err, callback) {
    N.models.users.User.remove({ _id : user_id }, function () {
      N.models.users.AuthLink.remove({ user_id : user_id }, function () {
        callback(err);
      });
    });
  }


  // Create user record
  //
  N.wire.on(apiPath, function user_create(env, callback) {
    var user = new N.models.users.User();

    user.nick       = env.data.reg_info.nick;
    user.joined_ip  = env.req.ip;
    user.locale     = env.user_info.locale || N.config.locales[0];
    user.email      = env.data.reg_info.email;

    user.save(function (err, user) {
      if (err) {
        callback(err);
        return;
      }

      env.data.user = user;
      callback();
    });
  });


  // Create plain auth record (nick + password record)
  //
  N.wire.after(apiPath, function create_user_privider(env, callback) {

    var user = env.data.user;

    var authLink = new N.models.users.AuthLink({
      user_id: user._id,
      type:    'plain',
      email:   env.data.reg_info.email,
      ip:      env.req.ip,
      last_ip: env.req.ip
    });

    authLink.setPass(env.data.reg_info.pass, function (err) {
      if (err) {
        // Can't fill hash - delete the user.
        // Should not happen in real life
        fail(user._id, err, callback);
        return;
      }

      authLink.save(function (err) {
        if (err) {
          // Can't create authLink - delete the user.
          // Should not happen in real life
          fail(user._id, err, callback);
          return;
        }

        callback();
      });
    });
  });


  // Create oauth provider record, if data filled
  //
  N.wire.after(apiPath, function create_oauth_privider(env, callback) {

    if (!env.data.oauth_info) {
      callback();
      return;
    }

    var user = env.data.user;
    var authLink = new N.models.users.AuthLink(env.data.oauth_info);

    authLink.user_id = user._id;
    authLink.ip      = env.req.ip;
    authLink.last_ip = env.req.ip;

    authLink.save(function (err) {
      if (err) {
        // Remove user and plain record
        fail(user._id, err, callback);
        return;
      }

      callback();
    });
  });
};
