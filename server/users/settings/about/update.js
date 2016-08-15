// Update user profile
//
'use strict';

const _ = require('lodash');


module.exports = function (N, apiPath) {

  let validate_params = {};

  validate_params.birthday = {
    anyOf: [
      { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      { type: 'null' }
    ]
  };

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

    if (env.params.birthday) {
      let date = new Date(env.params.birthday);

      if (!isNaN(date)) env.data.about.birthday = date;
    }

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
      { $set: { about: _.omitBy(env.data.about, _.isNull) } }
    );
  });
};
