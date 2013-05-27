'use strict';


var async = require('async');


exports.up = function (N, callback) {
  // FIXME implement sets of real group items
  async.forEachSeries(['administrators', 'guests', 'validating', 'members'], function(name, next) {
    var usergroup = new N.models.users.UserGroup({
      short_name:   name
    , is_protected: true
    });

    usergroup.save(next);
  }, callback);
};
