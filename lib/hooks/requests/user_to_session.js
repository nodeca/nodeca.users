// Init session with users data or guest defaults
//
"use strict";


var memoizee = require('memoizee');


var user_in_fields = [
  '_id',
  '_uname',
  'usergroups',
  'locale'
];


module.exports = function (N) {

  // cache guests usergroup._id forever,
  // as it will not going to be changed
  //
  var fetch_guests_usergroup = memoizee(
    // real handler
    function (shortName, callback) {
      N.models.users.UserGroup.findOne({
        short_name: shortName
      }).exec(callback);
    }, {
      // memoizee options
      async: true
    });


  function initGuestSession(env, callback) {
    fetch_guests_usergroup('guests', function (err, grp) {
      env.runtime.user_name = '';
      env.runtime.is_member = false;
      env.runtime.is_guest  = true;

      // propose guest user info to the settings params
      env.extras.settings.params.user_id       = 0;
      env.extras.settings.params.usergroup_ids = [ grp._id ];

      callback(err);
    });
  }


  // fetch current user info
  // fired before each controllers
  N.wire.before('server:**', { weight: -70 }, function load_current_user(env, callback) {
    //
    // if there's no session - skip
    //
    if (!env.session) {
      callback();
      return;
    }

    //
    // if there's no user_id in session or user_id == 0 - assume guest
    //

    if (!env.session.user_id) {
      initGuestSession(env, callback);
      return;
    }

    N.models.users.User
      .findOne({ '_id': env.session.user_id })
      .select(user_in_fields.join(' '))
      .setOptions({ lean: true })
      .exec(function (err, user) {
        if (err) {
          callback(err);
          return;
        }

        // user in session, but db does not know this user
        if (!user) {
          initGuestSession(env, callback);
          return;
        }

        // set user's locale
        if (user.locale) {
          env.session.locale = user.locale;
        }

        env.runtime.user_name = user._uname;
        env.runtime.is_guest  = false;
        env.runtime.is_member = true;

        // propose user info to the settings params
        env.extras.settings.params.user_id       = user._id;
        env.extras.settings.params.usergroup_ids = user.usergroups;

        callback();
      });
  });
};
