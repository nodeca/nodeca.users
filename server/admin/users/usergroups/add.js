"use strict";

/*global nodeca, _*/


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
  var item_categories = {};
  _.keys(settings).forEach(function(name) {
    var item = settings[name];
    var category_name = item['category'];
    if (!item_categories[category_name]) {
      item_categories[category_name] = {};
    }
    item_categories[category_name][name] = item;
  });

  env.data.item_categories = item_categories;
  next();
};


// Put usergroups items into response data
//
nodeca.filters.after('@', function (params, next) {
  this.response.data.item_categories = this.data.item_categories;
  next();
});


//
// Fill breadcrumbs and head meta
//
nodeca.filters.after('@', function set_forum_index_breadcrumbs(params, next) {
  this.response.data.head.title = this.helpers.t('admin.users.usergroups.add_title');
  this.response.data.widgets.breadcrumbs = [
    {
      text: this.helpers.t('admin.menus.navbar.system'),
      route: 'admin.dashboard'
    },
    {
      text: this.helpers.t('admin.menus.navbar.usergroups'),
      route: 'admin.users.usergroups.index'
    },
    {
      text: this.helpers.t('admin.users.usergroups.add_group_breadcrumb')
    }
  ];
  next();
});
