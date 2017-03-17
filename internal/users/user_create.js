// Creates user and AuthProviders.
// Expects env.data to be filled with:
//
//   reg_info:
//     nick
//     email
//     pass_hash
//   oauth_info:
//     ... # If oauth used, the same hash as AuthProvider schema
//
'use strict';


module.exports = function (N, apiPath) {

  // Create user record
  //
  N.wire.on(apiPath, function* user_create(env) {
    let user = new N.models.users.User();

    user.nick       = env.data.reg_info.nick;
    user.joined_ip  = env.req.ip;
    user.locale     = env.user_info.locale || N.config.locales[0];
    user.email      = env.data.reg_info.email;

    yield user.save();

    env.data.user = user;
  });


  // Create plain auth record (nick + password record)
  //
  N.wire.after(apiPath, function* create_user_provider(env) {
    let user = env.data.user;
    let authProvider = new N.models.users.AuthProvider({
      user:    user._id,
      type:    'plain',
      email:   env.data.reg_info.email,
      ip:      env.req.ip,
      last_ip: env.req.ip
    });

    try {
      yield authProvider.setPassHash(env.data.reg_info.pass_hash);
      yield authProvider.save();
    } catch (__) {
      yield N.models.users.User.remove({ _id: user._id });
      yield N.models.users.AuthProvider.remove({ user: user._id });
    }
  });


  // Create oauth provider record, if data filled
  //
  N.wire.after(apiPath, function* create_oauth_provider(env) {
    if (!env.data.oauth_info) return;

    let user = env.data.user;
    let authProvider = new N.models.users.AuthProvider(env.data.oauth_info);

    authProvider.user    = user._id;
    authProvider.ip      = env.req.ip;
    authProvider.last_ip = env.req.ip;

    try {
      yield authProvider.save();
    } catch (__) {
      yield N.models.users.User.remove({ _id: user._id });
      yield N.models.users.AuthProvider.remove({ user: user._id });
    }
  });
};
