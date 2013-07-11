// Init session with users data or guest defaults.


'use strict';


var memoizee = require('memoizee');


module.exports = function (N) {

  // Find and cache usergroup ObjectId forever. Use only for 'protected' groups.
  //
  var findUsergroupId = memoizee(function (shortName, callback) {
    N.models.users.UserGroup.findIdByName(shortName, callback);
  }, { async: true });


  function initGuestSession(env, callback) {
    env.extras.puncher.start('Load guest group id');

    findUsergroupId('guests', function (err, guestsId) {
      env.extras.puncher.stop();

      if (err) {
        callback(err);
        return;
      }

      env.runtime.user_name = '';
      env.runtime.is_member = false;
      env.runtime.is_guest  = true;

      // Propose guest user info to the settings params.
      env.extras.settings.params.user_id       = 0;
      env.extras.settings.params.usergroup_ids = [ guestsId ];

      callback();
    });
  }


  // Fetch current user info. Fired before each server handler.
  N.wire.before('server_chain:*', { priority: -65 }, function current_user_load(env, callback) {
    // Not logged in - initialize guest session.
    if (!env.session || !env.session.user_id) {
      initGuestSession(env, callback);
      return;
    }

    env.extras.puncher.start('Load user info');

    N.models.users.User
      .findById(env.session.user_id)
      .select('_id _uname usergroups locale')
      .setOptions({ lean: true })
      .exec(function (err, user) {

        env.extras.puncher.stop();

        if (err) {
          callback(err);
          return;
        }

        // User was deleted while session is still active - reinit as a guest.
        if (!user) {
          initGuestSession(env, callback);
          return;
        }

        if (user.locale) {
          env.session.locale = user.locale;
        }

        env.runtime.user_name = user._uname;
        env.runtime.is_guest  = false;
        env.runtime.is_member = true;

        // Propose user info to the settings params.
        env.extras.settings.params.user_id       = user._id;
        env.extras.settings.params.usergroup_ids = user.usergroups;

        callback();
      });
  });
};
