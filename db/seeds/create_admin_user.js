'use strict';

var async = require('async');
var prompt = require('prompt');

module.exports = function (N, cb) {
  var models = N.models;

  var user     = new models.users.User();
  var authLink     = new models.users.AuthLink();

  var login, password;

  async.series([
    function (next) {
      prompt.message = '';
      prompt.delimiter = '';
      prompt.start();

      var schema = [
        { name: 'login', description: 'Administrator login? (admin)' },
        { name: 'password', description: 'Administrator password? (admin)', hidden: true }
      ];

      prompt.get(schema, function (err, result) {
        if (err) {
          next(err);
          return;
        }

        login = result.login || 'admin';
        password = result.password || 'admin';

        next();
      });
    },

    // create admin user
    function (next) {
      // get administrators group Id
      models.users.UserGroup.findOne({ short_name: 'administrators' })
        .exec(function(err, group) {
          if (err) {
            next(err);
            return;
          }
          user.hid = 1;
          user.nick = login;
          user.email = 'admin@localhost';
          user.joined_ts = new Date();
          user.post_count = 1;
          user.usergroups = [ group ];

          user.save(next);
        });
    },

    // create auth link
    function (next) {

      authLink.type = 'plain';
      authLink.email = 'admin@example.com';
      authLink.setPass(password, function (err) {
        if (err) {
          next(err);
          return;
        }

        authLink.user_id = user._id;

        authLink.save(next);
      });
    }
  ], cb);
};
