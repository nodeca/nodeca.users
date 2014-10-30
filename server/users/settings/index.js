// Show settings page
//
'use strict';

module.exports = function (N, apiPath) {

  N.validate(apiPath, {});

    // Check permissions
  //
  N.wire.before(apiPath, function check_permissions(env) {
    if (env.user_info.is_guest) {
      return N.io.FORBIDDEN;
    }
  });


  // Fetch user
  //
  N.wire.before(apiPath, function fetch_user(env, callback) {
    N.models.users.User.findOne({ _id: env.session.user_id }).exec(function (err, user) {

      if (err) {
        callback(err);
        return;
      }

      env.data.user = user;
      callback();
    });
  });


  // Fill response
  //
  N.wire.on(apiPath, function fill_response(env, callback) {

    env.res.setting_schemas = N.config.setting_schemas.user || {};

    N.models.users.UserSettings.findOne({ user_id: env.session.user_id }).exec(function (err, settings) {

      if (err) {
        callback(err);
        return;
      }

      env.res.settings = settings || {};

      callback();
    });
  });


  //Fill head and breadcrumbs
  //
  N.wire.after(apiPath, function fill_head_and_breadcrumbs(env) {
    env.res.head = env.res.head || {};
    env.res.head.title = env.t('title');

    N.wire.emit('internal:users.breadcrumbs.fill_user', env);

    env.data.breadcrumbs.push({
      text   : env.t('title'),
      route  : 'users.settings',
      params : { 'user_hid': env.data.user.hid }
    });

    env.res.breadcrumbs = env.data.breadcrumbs;
  });
};
