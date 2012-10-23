"use strict";

/*global nodeca, _*/

var UserGroup = nodeca.models.users.UserGroup;

// Validate input parameters
//
var params_schema = {
};
nodeca.validate(params_schema);


/**
 * admin.usergroups.add(params, callback) -> Void
 *
 *
 * Display add group form
 *
 **/
module.exports = function (params, next) {
  var env = this;
  var settings = nodeca.config.setting_schemas['usergroup'];

  // collect usergroups items and group it by setting category
  var settings_categories = {};
  _.keys(settings).forEach(function(name) {
    var item = settings[name];
    var category_name = item['category'];
    if (!settings_categories[category_name]) {
      settings_categories[category_name] = {};
    }
    settings_categories[category_name][name] = item;
  });

  env.data.settings_categories = settings_categories;

  // collect existing usergroups for `parent group` select
  env.data.usergroups = [];
  UserGroup.find().select({ '_id':1, 'short_name': 1 })
      .setOptions({ lean: true }).exec(function(err, usergroups) {
    if (err) {
      next(err);
      return;
    }
    usergroups.forEach(function(group) {
        group._id = group._id.toString();
        env.data.usergroups.push(group);
      });
    next();
  });
};


// Put usergroups items into response data
//
nodeca.filters.after('@', function (params, next) {
  this.response.data.settings_categories = this.data.settings_categories;
  this.response.data.usergroups = this.data.usergroups;
  next();
});


//
// Fill head meta
//
nodeca.filters.after('@', function set_forum_index_breadcrumbs(params, next) {
  this.response.data.head.title = this.helpers.t('admin.users.usergroups.title.add');
  next();
});
