"use strict";

/*global nodeca*/

var UserGroup = nodeca.models.users.UserGroup;

// Validate input parameters
//
var params_schema = {
};
nodeca.validate(params_schema);


/**
 * admin.usergroups.index(params, callback) -> Void
 *
 *
 * Display group list
 *
 **/
module.exports = function (params, next) {
  var env = this;

  env.data.usergroups = [];
  UserGroup.find().select({ 'short_name': 1 }).setOptions({ lean: true }).exec(function(err, usergroups) {
    if (err) {
      next(err);
      return;
    }
    usergroups.forEach(function(group) {
      env.data.usergroups.push(group['short_name']);
    });
    next();
  });
};


// Put usergroups into response data
//
nodeca.filters.after('@', function (params, next) {
  this.response.data.usergroups = this.data.usergroups;
  next();
});


//
// Fill head meta
//
nodeca.filters.after('@', function set_forum_index_breadcrumbs(params, next) {
  this.response.data.head.title = this.helpers.t('admin.users.usergroups.title.index');

  next();
});
