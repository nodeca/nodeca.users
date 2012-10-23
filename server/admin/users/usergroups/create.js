"use strict";

/*global nodeca, _*/

var UserGroup = nodeca.models.users.UserGroup;

var usergroup_schema = nodeca.config.setting_schemas['usergroup'];

// Validate input parameters
//
var params_schema = {
  short_name: {
    type: 'string',
    required: true
  },
  parent_group: {
    type: 'string',
    default: null
  }
};

// Add usergroup settings as input params to validate schema
//
_.keys(usergroup_schema).forEach(function(name) {
  var item_type = usergroup_schema[name]['type'];
  // FIXME Implement complex types
  if (!_.any(['string', 'number', 'boolean'],
      function(t){ return t === item_type; })) {
    item_type = 'string';
  }
  params_schema[name] = { type: item_type };
});
nodeca.validate(params_schema);


/**
 * admin.usergroups.create(params, callback) -> Void
 *
 *
 * Create new usergroup
 *
 **/
module.exports = function (params, next) {
  var env = this;
  var usergroup;

  var raw_settings = _.clone(params);

  // remove short_name and parent group from settings set
  delete raw_settings['short_name'];
  delete raw_settings['parent_group'];

  // Check if group already exists
  UserGroup.findOne({ short_name: params.short_name }).exec(function(err, group) {
    if (err) {
      next(err);
      return;
    }

    // group already exists
    if (group) {
      next({
        code: nodeca.io.BAD_REQUEST,
        data: {
          short_name: env.helpers.t('admin.usergroups.form.error.short_name_busy')
        }
      });
      return;
    }

    // set default values
    _.keys(usergroup_schema).forEach(function(key) {
      if (_.isNull(raw_settings[key])) {
        raw_settings[key] = usergroup_schema[key]['default'];
      }
      // FIXME eval before_save code
    });

    usergroup = new UserGroup({
      short_name: params.short_name,
      parent: params.parent_group,
      raw_settings: raw_settings
    });

    usergroup.save(function(err){
      if (err) {
        next(err);
        return;
      }
      // FIXME calculate and save settings in store
      next();
    });
  });
};
