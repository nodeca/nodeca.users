"use strict";

/*global N*/

var async = require('async');


var models = N.models;

module.exports.up = function (cb) {
  // FIXME implement sets of real group items
  async.forEachSeries(['administrators','members','guests'],
    function(current_group, next_group) {
      var usergroup = new models.users.UserGroup({
        short_name: current_group,
        is_protected: true
      });
      usergroup.save(next_group);
    }
  , cb);
};
