"use strict";


var async = require('async');


module.exports.up = function (N, cb) {
  var models = N.models;

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
