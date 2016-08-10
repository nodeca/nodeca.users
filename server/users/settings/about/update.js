// Update user profile
//
'use strict';

const _ = require('lodash');


module.exports = function (N, apiPath) {

  let validate_params = {};

  if (N.config.users && N.config.users.about) {
    for (let name of Object.keys(N.config.users.about)) {
      validate_params[name] = { type: [ 'string', 'null' ], required: true };
    }
  }

  N.validate(apiPath, validate_params);


  // Check auth
  //
  N.wire.before(apiPath, function check_auth(env) {
    if (env.user_info.is_guest) {
      return N.io.FORBIDDEN;
    }
  });


  // Validate profile fields and copy valid ones to env.data.about
  //
  N.wire.before(apiPath, function validate_profile(env) {
    env.data.about = env.data.about || {};

    if (N.config.users && N.config.users.about) {
      for (let name of Object.keys(N.config.users.about)) {
        env.data.about[name] = env.params[name];
      }
    }
  });


  // Save profile
  //
  N.wire.on(apiPath, function* save_profile(env) {
    yield N.models.users.User.update(
      { _id: env.user_info.user_id },
      { $set: { about: _.omit(env.data.about, _.isNullOrUndefined) } }
    );
  });
};
