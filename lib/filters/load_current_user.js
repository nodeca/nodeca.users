"use strict";


/*global nodeca*/


var me_in_fields = [
  '_id',
  '_uname',
  'usergroups',
  'locale'
];


// memoized function -- caches forever
var fetch_guests_usergroup = nodeca.components.memoizee(
  // real handler
  function (shortName, callback) {
    nodeca.models.users.UserGroup.findOne({
      short_name: shortName
    }).exec(callback);
  }, {
    // momoize options
    async: true
  });


function initGuestSession(env, callback) {
  fetch_guests_usergroup('guests', function (err, ug) {
    env.runtime.user_name = '';
    env.runtime.is_member = false;
    env.runtime.is_guest  = true;

    env.settings.params.user_id       = 0;
    env.settings.params.usergroup_ids = [ ug._id ];

    callback(err);
  });
}


// fetch current user info
// fired before each controllers
nodeca.filters.before('', { weight: -70 }, function load_current_user(params, next) {
  var env = this;

  //
  // if there's no session - skip
  //

  if (!env.session) {
    next();
    return;
  }

  //
  // if there's no user_id in session - assume guest
  //

  if (!env.session.user_id) {
    initGuestSession(env, next);
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
        initGuestSession(env, next);
        return;
      }

      env.runtime.user_name = user._uname;
      env.runtime.is_guest  = false;
      env.runtime.is_member = true;

      // propose current user info to the settings params
      env.settings.params.user_id       = user._id;
      env.settings.params.usergroup_ids = user.usergroups;

      // set user's locale
      if (user.locale) {
        env.session.locale = user.locale;
      }

      next();
    });
});
