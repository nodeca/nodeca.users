// Creates user and AuthProviders.
// Expects env.data to be filled with:
//
//   reg_info:
//     nick
//     email
//     pass_hash
//
'use strict';


module.exports = function (N, apiPath) {

  // Create user record
  //
  N.wire.on(apiPath, async function user_create(env) {
    let user = new N.models.users.User();

    user.nick       = env.data.reg_info.nick;
    user.joined_ip  = env.req.ip;
    user.locale     = env.user_info.locale || N.config.locales[0];
    user.email      = env.data.reg_info.email;

    await user.save();

    env.data.user = user;
  });


  // Create plain auth record (nick + password record)
  //
  N.wire.after(apiPath, async function create_user_provider(env) {
    let user = env.data.user;
    let authProvider = new N.models.users.AuthProvider({
      user:    user._id,
      type:    'plain',
      email:   env.data.reg_info.email,
      ip:      env.req.ip,
      last_ip: env.req.ip
    });

    try {
      await authProvider.setPassHash(env.data.reg_info.pass_hash);
      await authProvider.save();
    } catch (__) {
      await N.models.users.User.deleteOne({ _id: user._id });
      await N.models.users.AuthProvider.deleteMany({ user: user._id });
    }
  });
};
