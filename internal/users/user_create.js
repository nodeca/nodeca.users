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
    N.models.users.User.remove({ '_id' : user_id }, function () {
      N.models.users.AuthLink.remove({ 'user_id' : user_id }, function () {
        callback(err);
      });
    });
  }


  // Create user record
  //
  N.wire.on(apiPath, function user_create(env,callback) {

    N.settings.get('registered_user_group', function (err, registeredGroupId) {

      if (err) {
        callback(err);
        return;
      }

      // Allocate user hid
      N.models.core.Increment.next('user', function (err, user_hid) {
        if (err) {
          callback(err);
          return;
        }

        var user = new N.models.users.User();

        user.hid        = user_hid;
        user.nick       = env.data.reg_info.nick;
        user.usergroups = [ registeredGroupId ];
        user.joined_ip  = env.req.ip;
        user.locale     = env.runtime.locale || N.config.locales['default'];
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
    });
  });


  // Create plain auth record (nick + password record)
  //
  N.wire.after(apiPath, function create_user_privider(env, callback) {

    var user = env.data.user;

    var authlink = new N.models.users.AuthLink({
      'user_id': user._id,
      'type' : 'plain',
      'email' : env.data.reg_info.email
    });

    authlink.setPass(env.data.reg_info.pass, function (err) {
      if (err) {
        // Can't fill hash - delete the user.
        // Should not happen in real life
        fail(user._id, err, callback);
        return;
      }

      authlink.save(function (err) {
        if (err) {
          // Can't create authlink - delete the user.
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
    var authlink = new N.models.users.AuthLink(env.data.oauth_info);

    authlink.user_id = user._id;

    authlink.save(function (err) {
      if (err) {
        // Remove user and plain record
        fail(user._id, err, callback);
        return;
      }

      callback();
    });
  });
};
