// Update user settings
//
'use strict';

const _ = require('lodash');


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

    _.forEach(settings, (value, key) => {

      if (!schema[key]) {
        valid = false;

        // Terminate foreach
        return false;
      }

      switch (schema[key].type) {

        case 'dropdown':
          if (!_.find(schema[key].values, { value })) {
            valid = false;
          }
          break;

        case 'boolean':
          if (!_.isBoolean(value)) {
            valid = false;
          }
          break;

        case 'string':
          if (!_.isString(value)) {
            valid = false;
          }

          if (!schema[key].empty_value && _.isEmpty(value)) {
            valid = false;
          }
          break;

        case 'number':
          if (!_.isNumber(value)) {
            valid = false;
          }
          break;

        default:
          valid = false;
      }
    });

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
  N.wire.on(apiPath, function* save_settings(env) {
    let settings = _.reduce(env.params.settings, (res, val, key) => {
      res[key] = { value: val };
      return res;
    }, {});

    yield N.settings.getStore('user').set(settings, { user_id: env.user_info.user_id });
  });
};
