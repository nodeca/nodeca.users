// Create parser settings for users application. Use `markup` schema as template.
//
// Note (!) `markup` schema in not used directly, that's a special hidden category.
// Forum settings are completely independent.
//
// You can override any default property by creating appropriate setting definition directly. Values will be merged.
//
'use strict';


const _ = require('lodash');


module.exports = function (N) {
  N.wire.before('init:models', function init_users_parser_settings() {
    const APP_PREFIX = 'users_';
    const CATEGORY_KEY = 'messages_markup';
    const GROUP_KEY = 'users_messages';

    let settingKey;

    _.forEach(N.config.setting_schemas.markup, (setting, key) => {
      settingKey = APP_PREFIX + key;

      // Create setting in global schema if not exists
      if (!N.config.setting_schemas.global[settingKey]) {
        N.config.setting_schemas.global[settingKey] = {};
      }

      // Fill defaults for setting
      _.defaults(N.config.setting_schemas.global[settingKey], setting, {
        category_key: CATEGORY_KEY,
        group_key: GROUP_KEY
      });

      // Fill defaults for setting
      _.defaults(N.config.setting_schemas.usergroup[settingKey], setting, { category_key: CATEGORY_KEY });

      // Copy locale if not exists
      _.forEach(N.config.i18n, locale => {
        if (
          locale.admin &&
          locale.admin.core &&
          locale.admin.core.setting_names &&
          !locale.admin.core.setting_names[settingKey]
        ) {
          locale.admin.core.setting_names[settingKey] = locale.admin.core.setting_names[key];
        }
      });
    });
  });
};
