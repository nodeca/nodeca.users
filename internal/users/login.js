// Update data to logged-in state:
//
// - recreate new session (change session id for security reasons)
// - fill redirection URL
// - log ip/time to AuthLink, been used for login
//
// Expects env.data filled with:
//
// - user
// - redirect_id (optional)
// - authLink
//


'use strict';


module.exports = function (N, apiPath) {

  var LoginRedirect = N.models.users.LoginRedirect;

  N.wire.on(apiPath, function user_internal_login(env, callback) {

    // delete old session (don't wait until compleete)
    if (env.session_id) {
      N.redis.del('sess:' + env.session_id);
    }

    env.session_id      = null; // Generate new sid on session save.
    env.session.user_id = env.data.user._id.toString();

    // fill redirect with default value
    env.data.redirect_url = N.router.linkTo('users.profile_redirect');

    // if no specific redirect requested - redirect to default
    if (!env.data.redirect_id) {
      callback();
      return;
    }

    // Try to find active redirect, bunded to this ip
    LoginRedirect.findOne({ '_id': env.data.redirect_id, used: false, ip: env.req.ip })
        .lean(true)
        .exec(function (err, link) {

      if (err) {
        callback(err);
        return;
      }

      // If redirect requested, but not found - redirect to default.
      if (!link) {
        callback();
        return;
      }

      // update redirect url
      env.data.redirect_url = link.url;

      // mark redirect as used
      LoginRedirect.update({ _id: link._id }, { $set: { used: true } }, callback);
    });
  });


  // Remember login ip and date in used AuthLink
  //
  N.wire.after(apiPath, function remember_auth_data(env, callback) {

    // authLink is not filled for (register + autologin)
    // Just skip update for this case.
    if (!env.data.authLink) {
      callback();
      return;
    }

    N.models.users.AuthLink.update(
      { _id: env.data.authLink._id },
      { $set: { last_ts: Date.now(), last_ip: env.req.ip } },
      callback
    );
  });
};
