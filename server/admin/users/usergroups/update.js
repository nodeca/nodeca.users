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
  }
};
_.keys(usergroup_schema).forEach(function(name) {
  var item_type = usergroup_schema[name]['type'];
  if (!_.any(['string', 'number', 'boolean'],
      function(t){ return t === item_type; })) {
    item_type = 'string';
  }
  params_schema[name] = { type: item_type };
});
nodeca.validate(params_schema);


/**
 * admin.usergroups.update(params, callback) -> Void
 *
 *
 * Update usergroup property
 **/
module.exports = function (params, next) {
  var items = _.clone(params);
  // remove short_name from property list
  delete items['short_name'];
  UserGroup.findOne({ short_name: params.short_name }).exec(function(err, group) {
    if (err) {
      next(err);
      return;
    }
    // group not found
    if (!group) {
      next({ statusCode: nodeca.io.NOT_FOUND });
      return;
    }

    // update group items one by one
    _.keys(items).forEach(function(name) {
      if (_.isNull(items[name])) {
        items[name] = usergroup_schema[name]['default'];
      }

      // FIXME eval before_save
      group.items[name] = items[name];
    });

    group.save(next);
  });
};
