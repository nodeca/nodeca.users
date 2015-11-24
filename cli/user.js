// Add new user or change password/groups of existing one via console.


'use strict';


var _     = require('lodash');
var async = require('async');



module.exports.parserParameters = {
  addHelp:     true,
  help:        'Create user and assign with some groups',
  description: 'Create user'
};


module.exports.commandLineArguments = [
  {
    args: [ 'action' ],
    options: {
      help: 'cli command add/update',
      choices: [ 'add', 'update' ]
    }
  },
  {
    args: [ '-g', '--group' ],
    options: {
      dest: 'mark_to_add',
      help: 'add user to group',
      action: 'append',
      defaultValue: [],
      type: 'string'
    }
  },
  {
    args: [ '-G', '--no-group' ],
    options: {
      dest: 'mark_to_remove',
      help: 'remove user from group',
      action: 'append',
      defaultValue: [],
      type: 'string'
    }
  },
  {
    args: [ '-u', '--user' ],
    options: {
      help: 'target user',
      type: 'string',
      required: true
    }
  },
  {
    args: [ '-p', '--pass' ],
    options: {
      help: 'user passsword. required only for add command',
      type: 'string'
    }
  },
  {
    args: [ '-e', '--email' ],
    options: {
      help: 'user email. required only for add command',
      type: 'string'
    }
  }
];


module.exports.run = function (N, args, callback) {

  N.wire.emit('init:models', N, function (err) {
    if (err) {
      callback(err);
      return;
    }

    var user     = null,
        toAdd    = {},
        toRemove = [];

    // FIXME check toRemove and toAdd intersection
    async.series([
      // check password and email
      function validate_params(next) {
        if (args.action === 'add' && !args.email) {
          next('Email is required');
          return;
        }

        if (args.action === 'add' && !args.pass) {
          next('Password is required');
          return;
        }

        next();
      },

      // fetch usergroups
      function fetch_usergroups(next) {
        var UserGroup = N.models.users.UserGroup;

        UserGroup.find().select('_id short_name').exec(function (err, docs) {
          if (err) {
            next(err);
            return;
          }

          docs.forEach(function (group) {
            if (args.mark_to_remove.indexOf(group.short_name) !== -1) {
              toRemove.push(group._id.toString());
            }
            if (args.mark_to_add.indexOf(group.short_name) !== -1) {
              toAdd[group._id.toString()] = group;
            }
          });

          // FIXME check all groups were found from both lists?
          next();
        });
      },

      // find or create user
      function find_user(next) {
        var User = N.models.users.User;

        User.findOne({ nick: args.user }).exec(function (err, doc) {
          if (err) {
            next(err);
            return;
          }

          if (args.action === 'add') {
            if (doc) {
              next('User with that name already exists');
              return;
            }

            user = new User({
              nick: args.user,
              joined_ts: new Date()
            });

            next();
            return;
          }

          if (!doc) {
            next('User not found, check name or use `add`');
            return;
          }

          user = doc;
          next();
        });
      },

      // set password
      function set_password(next) {
        if (!args.pass) {
          next();
          return;
        }

        // disable all other passwords
        N.models.users.AuthLink.update(
            { user_id: user._id, type: 'plain', exists: true },
            { $set: { exists: false } },
            { multi: true },
            function (err) {

          if (err) {
            next(err);
            return;
          }

          var authLink = new N.models.users.AuthLink();

          authLink.type = 'plain';
          authLink.email = args.email || user.email;

          authLink.setPass(args.pass, function (err) {
            if (err) {
              next(err);
              return;
            }

            authLink.user_id = user._id;
            authLink.ip = '127.0.0.1';
            authLink.last_ip = '127.0.0.1';

            authLink.save(next);
          });
        });
      },

      // set email and check that it's unique
      function set_email(next) {
        if (!args.email) {
          next();
          return;
        }

        var User = N.models.users.User;

        User.findOne({
          _id: { $ne: user._id },
          email: args.email
        }).exec(function (err, doc) {
          if (err) {
            next(err);
            return;
          }

          if (doc) {
            next('User with that email already exists');
            return;
          }

          user.email = args.email;
          next();
        });
      },

      // validate and update usergroups
      function update_usergroups(next) {
        if (!_.isEmpty(toRemove) && !_.isEmpty(user.usergroups)) {
          user.usergroups = user.usergroups.filter(function (group) {
            return toRemove.indexOf(group.toString()) === -1;
          });
        }
        if (!_.isEmpty(toAdd)) {
          // remove from toAdd list already assigned groups
          user.usergroups.forEach(function (group) {
            var group_id = group.toString();
            if (toAdd[group_id]) {
              toAdd = _.without(toAdd, group_id);
            }
          });
          if (!_.isEmpty(toAdd)) {
            _.values(toAdd).forEach(function (group) {
              user.usergroups.push(group);
            });
          }
        }

        next();
      },

      // save user
      function save_user(next) {
        user.save(next);
      }
    ], function (err) {
      if (err) {
        callback('User creation error: ' + String(err.message || err));
        return;
      }

      /*eslint-disable no-console*/
      console.log('OK\n');
      N.shutdown();
    });
  });
};
