// Check permission to subscribe `users.private.*.{hid}` channel
//
'use strict';


module.exports = function (N) {
  N.wire.before('internal.live.subscribe:users.private.*', function subscribe_permission_check(data, callback) {
    // Get user ID from channel name
    var user_id = data.channel.split('.').pop();

    // Load session
    data.getSession(function (err, session) {
      if (err) {
        callback(err);
        return;
      }

      if (!session) {
        callback();
        return;
      }

      if (user_id && session.user_id === user_id) {
        data.allowed = true;
      }

      callback();
    });
  });
};
