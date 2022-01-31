// Add user info loader helper
//
//   data.getUserInfo(function (err, user_info) {
//     // ...
//   });
//
'use strict';


const userInfo = require('nodeca.users/lib/user_info');


module.exports = function (N) {
  N.wire.before('internal.live.*', { priority: -100 }, function add_user_loader(data) {
    data.getUserInfo = async function () {
      // If `user_info` already loaded - skip
      if (data.__user_info__ || data.__user_info__ === null) {
        return data.__user_info__;
      }

      // Fetch session ID from token record
      let session_id = await N.redis.get(`token_live:to_sid:${data.message.token}`);

      // Check authentication if possible
      if (session_id) {
        let authSession = await N.models.users.AuthSession.findOne()
                                  .where('session_id').equals(session_id)
                                  .select('_id user')
                                  .lean(true);
        if (authSession) {
          data.__user_info__ = await userInfo(N, authSession.user);
          return data.__user_info__;
        }
      }

      // If token not found or user not logged in
      data.__user_info__ = null;
      return data.__user_info__;
    };
  });
};
