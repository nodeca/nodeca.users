// Form to edit user profile
//
'use strict';


const _ = require('lodash');


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
  N.wire.before(apiPath, function* fetch_user(env) {
    env.data.user = yield N.models.users.User.findOne({ _id: env.user_info.user_id });
  });


  // Fill contacts
  //
  N.wire.on(apiPath, function fill_contacts(env) {
    let about = env.data.user.about || {};

    env.res.about = [];

    env.res.about.push({
      name:     'birthday',
      value:    about.birthday,
      type:     'date',
      priority: 10
    });

    if (N.config.users && N.config.users.about) {
      for (let name of Object.keys(N.config.users.about)) {
        env.res.about.push({
          name,
          value:    about[name],
          priority: N.config.users.about[name].priority
        });
      }
    }

    env.res.about = _.sortBy(env.res.about, _.property('priority'));
  });


  // Fill head and breadcrumbs
  //
  N.wire.after(apiPath, function* fill_head_and_breadcrumbs(env) {
    env.res.head = env.res.head || {};
    env.res.head.title = env.t('title');

    yield N.wire.emit('internal:users.breadcrumbs.fill_user', env);

    env.data.breadcrumbs.push({
      text: env.t('breadcrumbs_title'),
      route: 'users.settings.general'
    });

    env.res.breadcrumbs = env.data.breadcrumbs;
  });
};
