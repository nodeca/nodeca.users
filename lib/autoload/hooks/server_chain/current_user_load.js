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
    findUsergroupId('guests', function (err, guestsId) {
      if (err) {
        callback(err);
        return;
      }

      env.user_info = {};
      env.user_info.hb = false;
      env.user_info.is_guest = true;
      env.user_info.is_member = false;
      env.user_info.user_id = null;

      // Fill user info for browser
      env.runtime.user_name = '';
      env.runtime.user_id = '000000000000000000000000';
      env.runtime.user_hid = 0;
      env.runtime.user_avatar = null;
      env.runtime.is_guest  = true;
      env.runtime.is_member = false;

      // Propose guest user info to the settings params.
      env.extras.settings.params.user_id       = '000000000000000000000000';
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

    N.models.users.User
      .findById(env.session.user_id)
      .select('_id hid name usergroups locale hb avatar_id')
      .lean(true)
      .exec(function (err, user) {
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

        env.user_info = {};
        env.user_info.hb = user.hb;
        env.user_info.is_guest = false;
        env.user_info.is_member = true;
        env.user_info.user_id = String(user._id);

        // Fill user info for browser
        env.runtime.user_name = user.name;
        env.runtime.user_id = String(user._id);
        env.runtime.user_hid = user.hid;
        env.runtime.user_avatar = user.avatar_id;
        env.runtime.is_guest  = false;
        env.runtime.is_member = true;

        // Propose user info to the settings params.
        env.extras.settings.params.user_id       = user._id;
        env.extras.settings.params.usergroup_ids = user.usergroups;

        callback();
      });
  });
};
