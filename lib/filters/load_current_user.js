"use strict";


/*global nodeca*/


var me_in_fields = [
  '_id',
  '_uname',
  'usergroups',
  'locale'
];


// fetch current user info
// fired before each controllers
nodeca.filters.before('', { weight: -70 }, function load_current_user(params, next) {
  var env = this;

  //
  // fill in default (guest) values
  //

  env.current_user = null;
  env.runtime.user_name = '';
  env.runtime.is_member = false;
  env.runtime.is_guest  = true;

  env.settings.params.user_id       = null;
  env.settings.params.usergroup_ids = [];

  //
  // if there's no session or session has no user_id, user is guest - skip
  //

  if (!env.session || !env.session.user_id) {
    next();
    return;
  }

  nodeca.models.users.User
    .findOne({ '_id': env.session.user_id })
    .select(me_in_fields.join(' '))
    .setOptions({ lean: true })
    .exec(function (err, user) {
      if (err) {
        next(err);
        return;
      }

      // user in session, but db does not know this user
      if (!user) {
        next();
        return;
      }

      env.current_user = user;
      env.runtime.user_name = user._uname;
      env.runtime.is_guest  = false;
      env.runtime.is_member = true;

      env.settings.params.user_id       = user._id;
      env.settings.params.usergroup_ids = user.usergroups;

      // set user's locale
      if (user.locale) {
        env.session.locale = user.locale;
      }

      next();
    });
});
