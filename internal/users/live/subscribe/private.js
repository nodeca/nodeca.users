// Check permission to subscribe `users.private.*.{hid}` channel
//
'use strict';


module.exports = function (N) {
  N.wire.before('internal.live.subscribe:users.private.*', function subscribe_permission_check(data, callback) {
    // Get user ID from channel name
    var userID = data.channel.split('.').pop();

    // Load session
    data.helpers.sessionLoad(function (err) {
      if (err) {
        callback(err);
        return;
      }

      if (data.session.user_id === userID) {
        data.allowed = true;
      }

      callback();
    });
  });
};
