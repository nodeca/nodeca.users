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
      let session_id = await N.redis.getAsync('token_live:' + data.message.token);

      // Fetch session
      let authSession = await N.models.users.AuthSession.findOne()
                                  .where('session_id').equals(session_id)
                                  .select('_id user')
                                  .lean(true);

      // If token not found
      if (!authSession) {
        data.__user_info__ = null;
        return data.__user_info__;
      }

      data.__user_info__ = await userInfo(N, authSession.user);

      return data.__user_info__;
    };
  });
};
