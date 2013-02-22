//  Create new usergroup
//
"use strict";


var _ = require('lodash');


module.exports = function (N, apiPath) {
  var params_schema = {
    short_name: {
      type: 'string',
      minLength: 1,
      required: true
    },
    parent: {
      type: 'string',
      'default': null,
      minLength: 24,
      maxLength: 24
    }
  };

  var usergroup_schema = N.config.setting_schemas['usergroup'];

  // Add usergroup settings as input params to validate schema
  //
  _.keys(usergroup_schema).forEach(function(name) {
    var item_type = usergroup_schema[name]['type'];
    // FIXME Implement complex types
    if (!_.any(['string', 'number', 'boolean'],
               function (t) { return t === item_type; } )) {
      item_type = 'string';
    }
    params_schema[name] = { type: item_type };
  });
  N.validate(params_schema);


  // Request handler
  //
  N.wire.on(apiPath, function (env, callback) {
    var UserGroup = N.models.users.UserGroup;
    var raw_settings = _.clone(env.params);

    // remove short_name and parent group from settings set
    delete raw_settings['short_name'];
    delete raw_settings['parent'];

    // Check if group already exists
    UserGroup.findOne({ short_name: env.params.short_name }).exec(function (err, group) {
      if (err) {
        callback(err);
        return;
      }

      // group already exists
      if (group) {
        callback({
          code: N.io.BAD_REQUEST,
          data: {
            common: env.helpers.t('admin.users.usergroups.edit.error.short_name_busy')
          }
        });
        return;
      }

      // set default values
      _.keys(usergroup_schema).forEach(function (key) {
        if (_.isNull(raw_settings[key])) {
          raw_settings[key] = usergroup_schema[key]['default'];
        }
        // FIXME eval before_save code
      });

      var new_group = new UserGroup({
        short_name: env.params.short_name,
        raw_settings: raw_settings
      });
      if (!_.isEmpty(env.params.parent)) {
        new_group.parent = env.params.parent;
      }

      new_group.save(function (err) {
        if (err) {
          callback(err);
          return;
        }

        var values = {};

        // prepare values for the store
        _.each(values, function (val, key) {
          values[key] = { value: val };
        });

        N.settings.set('usergroup', values, { usergroup_id: new_group._id }, callback);
      });
    });
  });
};
