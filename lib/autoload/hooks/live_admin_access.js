'use strict';


var userInfo = require('nodeca.users/lib/user_info');


module.exports = function (N) {
  N.wire.on('internal.live.subscribe:admin.*', function live_admin_access(data, callback) {
    data.getSession(function (err, session) {
      if (err) {
        callback(err);
        return;
      }

      if (!session.user_id) {
        callback();
        return;
      }

      userInfo(N, session.user_id, function (err, info) {
        if (err) {
          callback(err);
          return;
        }

        var params = {
          user_id: info.user_id,
          usergroup_ids: info.usergroups
        };

        N.settings.get('can_access_acp', params, {}, function (err, can_access_acp) {
          if (err) {
            callback(err);
            return;
          }

          if (can_access_acp) {
            data.allowed = true;
          }

          callback();
        });
      });
    });
  });
};
