'use strict';


var async   = require('async');
var thenify = require('thenify');


exports.up = thenify(function (N, callback) {
  // FIXME implement sets of real group items
  async.eachSeries([ 'administrators', 'guests', 'members' ], function (name, next) {
    var usergroup = new N.models.users.UserGroup({
      short_name:   name,
      is_protected: true
    });

    usergroup.save(next);
  }, callback);
});
