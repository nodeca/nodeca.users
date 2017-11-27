// Activates user account.
// Check token. If token is correct - create User and AuthProvider records.


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    secret_key: { type: 'string', required: true }
  });


  // Kick logged-in members
  //
  N.wire.before(apiPath, function register_guest_only(env) {
    return N.wire.emit('internal:users.redirect_not_guest', env);
  });


  // Create default response (with failing state)
  //
  N.wire.before(apiPath, function prepare_response(env) {
    env.res.head.title = env.t('title');
  });


  // Check auth token
  //
  N.wire.before(apiPath, async function check_activation_token_and_user(env) {

    let token = await N.models.users.TokenActivationEmail
                          .findOne({ secret_key: env.params.secret_key })
                          .lean(true); // because we use model's instance method 'isExpired'

    // No token found or it's expired. Show 'Invalid token' page.
    if (!token || token.session_id !== env.session_id) return;

    env.data.token = token;

    // Token can be used only once.
    await N.models.users.TokenActivationEmail.remove({ secret_key: env.params.secret_key });
  });

  //
  // That's almost impossible, but someone could occupy nick/email if user
  // activated account too late. Or if user started registration twice and
  // got 2 emails. So, we check again that nick & emails are unique.
  //

  // Check nick uniqueness
  //
  N.wire.before(apiPath, async function check_nick_uniqueness(env) {

    let token = env.data.token;

    if (!token) return;

    if (await N.models.users.User.similarExists(token.reg_info.nick)) {
      // Need to terminate chain without 500 error.
      // If user exists - kill fetched token as invalid.
      env.data.token = null;
      return;
    }
  });


  // Check email uniqueness. User email and oauth provider email should be unique
  //
  N.wire.before(apiPath, async function check_email_uniqueness(env) {

    let token = env.data.token;

    if (!token) return;

    if (await N.models.users.AuthProvider.similarEmailExists(token.reg_info.email)) {
      // Need to terminate chain without 500 error.
      // If email(s) occupied - kill fetched token as invalid.
      env.data.token = null;
      return;
    }

    if (token.oauth_info) {
      if (await N.models.users.AuthProvider.similarEmailExists(token.oauth_info.email)) {
        // Need to terminate chain without 500 error.
        // If email(s) occupied - kill fetched token as invalid.
        env.data.token = null;
        return;
      }
    }
  });


  // Create user record and login
  //
  N.wire.on(apiPath, async function create_user(env) {

    let token = env.data.token;

    if (!token) return;

    env.data.reg_info = token.reg_info;
    env.data.oauth_info = token.oauth_info; // -> oauth_info

    await N.wire.emit('internal:users.user_create', env);

    // authProvider info is needed to create AuthSession
    //
    // TODO: when we will have oauth registration, it should select link based on
    //       env.data.oauth_info
    //
    env.data.authProvider = await N.models.users.AuthProvider.findOne({ user: env.data.user._id });

    await N.wire.emit('internal:users.login', env);

    // Use redirect instead of direct page rendering, because
    // we need to reload client environment with the new user data
    //
    throw {
      code: N.io.REDIRECT,
      head: {
        Location: N.router.linkTo('users.auth.register.activate_done')
      }
    };
  });
};
