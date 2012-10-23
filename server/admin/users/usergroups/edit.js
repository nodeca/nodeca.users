"use strict";

/*global nodeca, _*/


var UserGroup = nodeca.models.users.UserGroup;

// Validate input parameters
//
var params_schema = {
  short_name: {
    type: 'string',
    required: true
  }
};
nodeca.validate(params_schema);


/**
 * admin.usergroups.edit(params, callback) -> Void
 *
 *
 * Display usergroup
 *
 **/
module.exports = function (params, next) {
  var env = this;
  env.data.usergroups = [];

  UserGroup.findOne({ short_name: params.short_name })
      .setOptions({ lean: true }).exec(function(err, group) {
    if (err) {
      next(err);
      return;
    }
    if (!group) {
      next(nodeca.io.NOT_FOUND);
      return;
    }

    // FIXME fetch settings from store
    var settings = nodeca.config.setting_schemas['usergroup'];

    // collect  usergroups items and group it by setting group
    var settings_categories = {};
    _.keys(settings).forEach(function(name) {
      var item = settings[name];

      // mark setting as overriden
      if (group.raw_settings && name in group.raw_settings) {
        item.overriden = true;
      }

      var category_name = item['category'];
      if (!settings_categories[category_name]) {
        settings_categories[category_name] = {};
      }
      settings_categories[category_name][name] = item;
    });
    env.data.settings_categories = settings_categories;

    group._id = group._id.toString();
    env.data.current = group;

    // fetch other groups need for parent selected
    UserGroup.find().select({ '_id':1, 'short_name': 1 })
        .setOptions({ lean: true }).exec(function(err, usergroups) {
      usergroups.forEach(function(group) {
        group._id = group._id.toString();
        // group can't be parent of him self
        if (group._id === env.data.current._id) {
          return;
        }
        env.data.usergroups.push(group);
      });
      next();
    });
  });
};


// Put currents items into response data
//
nodeca.filters.after('@', function (params, next) {
  this.response.data.current = this.data.current;
  this.response.data.usergroups = this.data.usergroups;
  this.response.data.settings_categories = this.data.settings_categories;

  next();
});


//
// Fill head meta
//
nodeca.filters.after('@', function set_forum_index_breadcrumbs(params, next) {
  this.response.data.head.title = this.helpers.t(
    'admin.users.usergroups.title.edit',
    { short_name: this.data.current.short_name }
  );
  next();
});
