"use strict";

var async = require('async');

module.exports = function (N, cb) {
  var models = N.models;

  var user     = new models.users.User();
  var auth     = new models.users.AuthLink();

  async.series([
    // create admin user
    function (callback) {
      // get administrators group Id
      models.users.UserGroup.findOne({ short_name: 'administrators' })
        .exec(function(err, group) {
          if (err) {
            callback(err);
            return;
          }
          user.id = 1;
          user.nick = 'admin';
          user.email = 'admin@localhost';
          user.joined_ts = new Date;
          user.post_count = 1;
          user.usergroups = [group];

          user.save(callback);
        });
    },

    // create auth link
    function (callback) {
      var provider = auth.providers.create({
        'type': 'plain',
        'email': 'admin@example.com'
      });

      provider.setPass('admin');

      auth.user_id = user._id;
      auth.providers.push(provider);

      auth.save(callback);
    }
  ], cb);
};
