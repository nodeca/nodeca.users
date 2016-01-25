// Update user settings
//
'use strict';

var _ = require('lodash');


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    settings: {
      type: 'object',
      required: true
    }
  });


  // Validate settings names and values
  //
  N.wire.before(apiPath, function validate_settings(env, callback) {
    var schema = N.config.setting_schemas.user || {};
    var settings = env.params.settings;
    var valid = true;

    _.forEach(settings, function (value, key) {

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

    if (valid) {
      callback();
    } else {
      callback(N.io.FORBIDDEN);
    }
  });


  // Check auth
  //
  N.wire.before(apiPath, function check_auth(env) {
    if (env.user_info.is_guest) {
      return N.io.FORBIDDEN;
    }
  });


  // Save settings
  //
  N.wire.on(apiPath, function save_settings(env, callback) {
    var settings = _.reduce(env.params.settings, function (res, val, key) {
      res[key] = { value: val };
      return res;
    }, {});

    N.settings.getStore('user').set(settings, { user_id: env.user_info.user_id }, callback);
  });
};
