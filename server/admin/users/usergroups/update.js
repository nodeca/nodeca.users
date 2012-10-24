"use strict";

/*global nodeca, _*/

var UserGroup = nodeca.models.users.UserGroup;

var usergroup_schema = nodeca.config.setting_schemas['usergroup'];

// Validate input parameters
//
var params_schema = {
  _id: {
    type: 'string',
    required: true
  },
  parent: {
    type: 'string',
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
  // remove _id parent from property list
  delete items['_id'];
  delete items['parent'];

  UserGroup.findById(params._id).exec(function(err, group) {
    if (err) {
      next(err);
      return;
    }
    // group not found
    if (!group) {
      next(nodeca.io.NOT_FOUND);
      return;
    }

    // update parent
    if (!_.isUndefined (params.parent)) {
      group.parent = params.parent;
    }

    // update group items one by one
    _.keys(items).forEach(function(name) {
      if (_.isNull(items[name])) {
        items[name] = usergroup_schema[name]['default'];
      }

      // FIXME eval before_save
      group.raw_settings[name] = items[name];
    });

    // this command required for update Mixed fields
    // see Mixed in http://mongoosejs.com/docs/schematypes.html
    group.markModified('raw_settings');
    group.save(next);
  });
};
