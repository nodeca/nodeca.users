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

  UserGroup.find().exec(function(err, usergroups) {
    if (err) {
      next(err);
      return;
    }
    if (!usergroups) {
      next(nodeca.io.NOT_FOUND);
      return;
    }

    var settings = nodeca.config.setting_schemas['usergroup'];

    usergroups.forEach(function(group) {
      if (group.short_name === params.short_name) {
        // collect  usergroups items and group it by setting group
        var item_categories = {};
        _.keys(settings).forEach(function(name) {
          var item = settings[name];
          // get value from model if exists
          if (name in group.items) {
            item.value = group.items[name];
          }

          var category_name = item['category'];
          if (!item_categories[category_name]) {
            item_categories[category_name] = {};
          }
          item_categories[category_name][name] = item;
        });
        env.data.item_categories = item_categories;

        env.data.usergroup = group;
      }
      else {
        env.data.usergroups.push({ '_id': group._id, 'short_name': group.short_name });
      }
    });
    if (!env.data.usergroup) {
      next(nodeca.io.NOT_FOUND);
      return;
    }
    next();
  });
};


// Put usergroups items into response data
//
nodeca.filters.after('@', function (params, next) {
  this.response.data.short_name = this.data.usergroup.short_name;
  this.response.data.parent_group = this.data.usergroup.parent_group;
  this.response.data.usergroups = this.data.usergroups;
  this.response.data.item_categories = this.data.item_categories;

  next();
});


//
// Fill head meta
//
nodeca.filters.after('@', function set_forum_index_breadcrumbs(params, next) {
  this.response.data.head.title = this.helpers.t(
    'admin.users.usergroups.edit_title',
    { short_name: this.data.usergroup.short_name }
  );
  next();
});
