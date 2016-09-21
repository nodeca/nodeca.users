// Update user profile
//
'use strict';

const _ = require('lodash');


module.exports = function (N, apiPath) {

  let validate_params = {};

  validate_params.birthday = { type: [ 'string', 'null' ], required: true };

  if (N.config.users && N.config.users.about) {
    for (let name of Object.keys(N.config.users.about)) {
      validate_params[name] = { type: [ 'string', 'null' ], required: true };
    }
  }

  N.validate(apiPath, validate_params);


  // Check permissions
  //
  N.wire.before(apiPath, function* check_permissions(env) {
    if (env.user_info.is_guest) {
      throw N.io.FORBIDDEN;
    }

    let can_edit_profile = yield env.extras.settings.fetch('can_edit_profile');

    if (!can_edit_profile) {
      throw N.io.FORBIDDEN;
    }
  });


  // Validate profile fields and copy valid ones to env.data.about
  //
  /* eslint-disable max-depth */
  N.wire.before(apiPath, function* validate_profile(env) {
    env.data.about  = env.data.about || {};
    env.data.errors = env.data.errors || {};

    if (env.params.birthday) {
      let birthday_is_valid = false;

      if (env.params.birthday.match(/^\d{4}-\d{2}-\d{2}$/)) {
        let date = new Date(env.params.birthday);

        if (!isNaN(date)) {
          let year = date.getFullYear();

          if (year >= 1900 && year <= new Date().getFullYear()) {
            env.data.about.birthday = date;
            birthday_is_valid = true;
          }
        }
      }

      if (!birthday_is_valid) env.data.errors.birthday = true;
    }

    if (N.config.users && N.config.users.about) {
      for (let name of Object.keys(N.config.users.about)) {
        let value = (env.params[name] || '').trim();

        if (!value) continue;

        // try to validate it using regexp
        if (N.config.users.about[name].validate_re) {
          if (!new RegExp(N.config.users.about[name].validate_re).test(value)) {
            env.data.errors[name] = true;
            continue;
          }
        }

        // try to validate it using custom wire method
        if (N.config.users.about[name].validate) {
          let data = { value };

          yield N.wire.emit(N.config.users.about[name].validate, data);

          if (!data.is_valid) {
            env.data.errors[name] = true;
            continue;
          }

          // override it with formatted value if available
          if (data.formatted) {
            env.data.about[name] = data.formatted;
            continue;
          }
        }

        env.data.about[name] = value;
      }
    }
  });


  // Save profile
  //
  N.wire.on(apiPath, function* save_profile(env) {
    if (!_.isEmpty(env.data.errors)) {
      throw {
        code: N.io.CLIENT_ERROR,
        data: env.data.errors
      };
    }

    let updateData;

    if (!_.isEmpty(env.data.about)) {
      updateData = { $set: { about: env.data.about } };
    } else {
      updateData = { $unset: { about: true } };
    }

    yield N.models.users.User.update(
      { _id: env.user_info.user_id },
      updateData
    );

    // update all fields on the client with normalized values
    env.res.about = {};

    Object.keys(env.data.about).forEach(name => {
      if (_.isDate(env.data.about[name])) {
        env.res.about[name] = env.data.about[name].toISOString().slice(0, 10);
      } else {
        env.res.about[name] = env.data.about[name];
      }
    });
  });
};
