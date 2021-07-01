// Inject info about users to env (~ manual join)
//
'use strict';


const _        = require('lodash');
const memoize  = require('promise-memoize');


// list of fields exposed to the client
const user_fields_public = [
  '_id',
  'hid',
  'name',
  'nick',
  'avatar_id'
];

// list of fields to fetch from db
const user_fields_fetch = user_fields_public.concat([ 'usergroups' ]);


module.exports = function (N) {

  const resolve_usergroup_name = memoize(function (id) {
    return N.models.users.UserGroup.findById(id)
              .select('-_id short_name')
              .lean(true)
              .then(usergroup => usergroup.short_name);
  }, { maxAge: 5 * 60 * 1000 });

  // Fetch permission to see deleted users
  //
  N.wire.after('server_chain:*', { priority: 50 }, async function fetch_can_see_deleted_users(env) {
    let can_see_deleted_users = await env.extras.settings.fetch('can_see_deleted_users');

    env.data.settings = env.data.settings || {};
    env.data.settings.can_see_deleted_users = can_see_deleted_users;
  });


  // fetch and prepare users info
  // fired after each controllers
  // list of user id should be prepared in controller
  N.wire.after('server_chain:*', { priority: 50 }, async function users_join(env) {

    if (!_.isArray(env.data.users) || !env.data.users.length) return;

    // There can be some garbage:
    // - empty ids (just because we push data without checks)
    // - duplicated ids(the same users from different objects)
    //
    // We remove dummy elements, but let mongo filter unique values,
    // because it's more fast.
    let user_ids = _.compact(env.data.users);

    env.res.users = env.res.users || {};

    // uncomment to imitate empty users (to check template & speed)
    //    env.extras.puncher.stop();
    //    return callback();

    let query = N.models.users.User
      .where('_id').in(user_ids)
      .select(user_fields_fetch.join(' '))
      .lean(true);

    // Check 'can_see_deleted_users' permission
    if (!env.data.settings.can_see_deleted_users) {
      query.where({ exists: true });
    }

    let user_list = await query.exec();

    // local "id -> class_name" cache
    let usergroup_classes = Object.create(null);

    for (let user of user_list) {
      // only registered users can see full name and avatar
      if (!env.user_info.is_member) {
        user.name = user.nick;
        user.avatar_id = null;
      }

      let css_classes = [];

      for (let id of user.usergroups) {
        if (!(id in usergroup_classes)) {
          // get usergroup name by id
          let name = await resolve_usergroup_name(id);

          // get usergroup class by name from N.config.users.usergroups_css[name]
          let css = N.config.users?.usergroups_css?.[name] || '';

          usergroup_classes[id] = css;
        }

        if (usergroup_classes[id]) css_classes.push(usergroup_classes[id]);
      }

      env.res.users[user._id] = _.pick(user, user_fields_public);
      env.res.users[user._id].css = css_classes.join(' ');
    }

    // reset pending list to avoid multiple joins on server subrequests
    env.data.users = [];
  });


  // Add users to page_data, needed to display avatars on the client-side
  // after the first page load
  //
  N.wire.after('server_chain:http:*', { priority: 50 }, function add_users_to_page_data(env) {
    env.runtime.page_data.users = env.res.users;
  });
};
