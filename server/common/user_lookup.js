// Select list of users, starting by pattern.
//
'use strict';


const _ = require('lodash');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    nick: { type: 'string', required: true }
  });


  // Check user permissions
  //
  N.wire.before(apiPath, function check_permissions(env) {
    if (env.user_info.is_guest) throw N.io.NOT_FOUND;
  });


  // Find users and fill response
  //
  N.wire.on(apiPath, function* find_users(env) {
    if (env.params.nick.length < 3) {
      env.res = [];
      return;
    }

    let users = yield N.models.users.User.find()
                          .where('nick_normalized_lc').regex(
                              new RegExp('^' + _.escapeRegExp(env.params.nick.toLowerCase())))
                          .where('exists').equals(true)
                          .sort('nick')
                          .limit(10)
                          .select('_id name nick')
                          .lean(true);

    users = _.filter(users, u => String(u._id) !== env.user_info.user_id); // exclude current user

    env.res = users;
  });
};
