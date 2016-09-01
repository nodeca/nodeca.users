'use strict';

const _ = require('lodash');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    user_hid: { type: 'integer', minimum: 1, required: true }
  });


  // Fetch member by 'user_hid'
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env) {
    return N.wire.emit('internal:users.fetch_user_by_hid', env);
  });


  // Fill user
  //
  N.wire.on(apiPath, function fill_user(env) {
    env.res.head = env.res.head || {};
    env.res.head.title = env.data.user.name;

    env.res.user = _.pick(env.data.user, [
      '_id',
      'avatar_id',
      'name'
    ]);
  });
};
