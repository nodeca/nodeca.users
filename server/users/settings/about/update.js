// Update user profile
//
'use strict';

const _ = require('lodash');


module.exports = function (N, apiPath) {

  let validate_params = {};

  validate_params.birthday = { type: [ 'string', 'null' ] };

  if (N.config.users && N.config.users.about) {
    for (let name of Object.keys(N.config.users.about)) {
      validate_params[name] = { type: [ 'string', 'null' ] };
    }
  }

  N.validate(apiPath, {
    properties: validate_params,
    additionalProperties: true
  });


  // Check permissions
  //
  N.wire.before(apiPath, { priority: -30 }, async function check_permissions(env) {
    if (!env.user_info.is_member) {
      throw N.io.FORBIDDEN;
    }

    let can_edit_profile = await env.extras.settings.fetch('can_edit_profile');

    if (!can_edit_profile) {
      throw N.io.FORBIDDEN;
    }
  });


  // Fetch current user
  //
  N.wire.before(apiPath, { priority: -30 }, async function fetch_user(env) {
    env.data.user = await N.models.users.User.findById(env.user_info.user_id).lean(false);

    if (!env.data.user) throw N.io.NOT_FOUND;
  });


  // Validate profile fields and copy valid ones to env.data.about
  //
  /* eslint-disable max-depth */
  N.wire.before(apiPath, async function validate_profile(env) {
    env.data.user.about = env.data.user.about || {};
    env.data.errors     = env.data.errors || {};

    // object "setting_name" => { value, readonly },
    // used to update form on the client after save
    env.res.fields      = env.res.fields || {};

    if (env.params.birthday) {
      let birthday_is_valid = false;

      if (env.params.birthday.match(/^\d{4}-\d{2}-\d{2}$/)) {
        let date = new Date(env.params.birthday);

        if (!isNaN(date)) {
          let year = date.getFullYear();

          if (year >= 1900 && year <= new Date().getFullYear()) {
            env.data.user.about.birthday = date;
            env.res.fields.birthday = { value: date.toISOString().slice(0, 10) };
            birthday_is_valid = true;
          }
        }
      }

      if (!birthday_is_valid) env.data.errors.birthday = true;
    }

    if (N.config.users && N.config.users.about) {
      for (let name of Object.keys(N.config.users.about)) {
        if (typeof env.params[name] === 'undefined') continue;

        let value = (env.params[name] || '').trim();

        if (!value) {
          delete env.data.user.about[name];
          continue;
        }

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

          await N.wire.emit(N.config.users.about[name].validate, data);

          if (!data.is_valid) {
            env.data.errors[name] = true;
            continue;
          }

          // override it with formatted value if available
          if (data.formatted) {
            env.data.user.about[name] = data.formatted;
            env.res.fields[name]      = { value: data.formatted };
            continue;
          }
        }

        env.data.user.about[name] = value;
        env.res.fields[name]      = { value };
      }
    }

    env.data.user.markModified('about');
  });


  // Save profile
  //
  N.wire.on(apiPath, async function save_profile(env) {
    if (!_.isEmpty(env.data.errors)) {
      throw {
        code: N.io.CLIENT_ERROR,
        data: env.data.errors
      };
    }

    if (_.isEmpty(env.data.user.about)) {
      /* eslint-disable no-undefined */
      env.data.user.about = undefined;
    }

    await env.data.user.save();
  });
};
