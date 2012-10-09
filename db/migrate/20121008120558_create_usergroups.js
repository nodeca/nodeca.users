"use strict";

/*global nodeca*/

var NLib = require('nlib');

var Async = NLib.Vendor.Async;

var models = nodeca.models;

module.exports.up = function (cb) {
  // FIXME implement sets of real froup items
  Async.forEachSeries(['administrators','members','guests'],
    function(current_group, next_group) {
      var usergroup = new models.users.UserGroup({short_name: current_group});
      usergroup.save(next_group);
    }
  , cb);
};
