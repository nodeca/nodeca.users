// Update user settings
//
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    settings: { type: 'object', required: true }
  });


  // Validate settings names and values
  //
  N.wire.before(apiPath, function validate_settings(env) {
    let schema = N.config.setting_schemas.user || {};
    let settings = env.params.settings;
    let valid = true;

    for (let [ key, value ] of Object.entries(settings)) {
      if (!schema[key]) {
        valid = false;

        // Terminate foreach
        return false;
      }

      switch (schema[key].type) {

        case 'dropdown':
          if (!schema[key].values.some(v => v.value === value)) {
            valid = false;
          }
          break;

        case 'boolean':
          if (typeof value !== 'boolean') {
            valid = false;
          }
          break;

        case 'string':
          if (typeof value !== 'string') {
            valid = false;
          }

          if (!schema[key].empty_value && value === '') {
            valid = false;
          }
          break;

        case 'number':
          if (typeof value !== 'number') {
            valid = false;
          }
          break;

        default:
          valid = false;
      }
    }

    if (!valid) {
      return N.io.FORBIDDEN;
    }
  });


  // Check auth
  //
  N.wire.before(apiPath, function check_auth(env) {
    if (!env.user_info.is_member) {
      return N.io.FORBIDDEN;
    }
  });


  // Save settings
  //
  N.wire.on(apiPath, async function save_settings(env) {
    let settings = {};

    for (let [ key, val ] of Object.entries(env.params.settings)) {
      settings[key] = { value: val };
    }

    await N.settings.getStore('user').set(settings, { user_id: env.user_info.user_id });
  });
};
