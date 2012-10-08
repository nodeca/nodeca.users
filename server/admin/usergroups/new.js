"use strict";

/*global nodeca, _*/


// Validate input parameters
//
var params_schema = {
};
nodeca.validate(params_schema);


/**
 * admin.usergroups.new(params, callback) -> Void
 *
 *
 * Display new group form
 *
 **/
module.exports = function (params, next) {
  var env = this;
  var settings = nodeca.config.setting_schemas['usergroup'];

  // collect usergroups items and group it by setting group
  var item_groups = {};
  _.keys(settings).forEach(function(name) {
    var item = settings[name];
    var group_name = item['group'];
    if (!item_groups[group_name]) {
      item_groups[group_name] = {};
    }
    item_groups[group_name][name] = item;
  });

  env.data.item_groups = item_groups;
  next();
};

// Put usergroups items into response data
//
nodeca.filters.after('@', function (params, next) {
  this.response.data.item_groups = this.data.item_groups;
  next();
});
