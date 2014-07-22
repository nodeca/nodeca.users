// Apply login on current session and change session id for security reasons.


'use strict';


module.exports = function (N, apiPath) {

  N.wire.on(apiPath, function user_internal_login(env,callback) {

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

    N.models.users.LoginRedirect
      .findOne({ '_id': env.data.redirect_id })
      .lean(true)
      .exec(function (err, link) {

        if (err) {
          callback(err);
          return;
        }

        // If redirect requested, but not found - redirect to default.
        // In other case, we have to mark redirect as used.

        if (!link) {
          callback();
          return;
        }

        // update redirect if conditions are valid

        if (!link.used && link.ip && link.ip === env.req.ip) {
          env.data.redirect_url = link.url;
        }

        // mark link as used and return

        N.models.users.LoginRedirect
          .findByIdAndUpdate(env.data.redirect_id, { $set: { used: true } })
          .lean(true)
          .exec(function (err) {
            callback(err);
          });
      });

  });
};
