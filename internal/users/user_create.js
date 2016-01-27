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
  N.wire.after(apiPath, function* create_user_privider(env) {
    let user = env.data.user;
    let authLink = new N.models.users.AuthLink({
      user_id: user._id,
      type:    'plain',
      email:   env.data.reg_info.email,
      ip:      env.req.ip,
      last_ip: env.req.ip
    });

    try {
      yield authLink.setPass(env.data.reg_info.pass);
      yield authLink.save();
    } catch (__) {
      yield N.models.users.User.remove({ _id: user._id });
      yield N.models.users.AuthLink.remove({ user_id: user._id });
    }
  });


  // Create oauth provider record, if data filled
  //
  N.wire.after(apiPath, function* create_oauth_privider(env) {
    if (!env.data.oauth_info) return;

    let user = env.data.user;
    let authLink = new N.models.users.AuthLink(env.data.oauth_info);

    authLink.user_id = user._id;
    authLink.ip      = env.req.ip;
    authLink.last_ip = env.req.ip;

    try {
      yield authLink.save();
    } catch (__) {
      yield N.models.users.User.remove({ _id: user._id });
      yield N.models.users.AuthLink.remove({ user_id: user._id });
    }
  });
};
