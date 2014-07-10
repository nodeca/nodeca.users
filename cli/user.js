// Add new user or change password/groups of existing one via console.


'use strict';


var _     = require('lodash');
var async = require('async');



module.exports.parserParameters = {
  addHelp:     true
, help:        'Create user and assign with some groups'
, description: 'Create user'
};


module.exports.commandLineArguments = [
  {
    args: [ 'action' ]
  , options: {
      help: 'cli command add/update'
    , choices: [ 'add', 'update' ]
    }
  }
, {
    args: [ '-g', '--group' ]
  , options: {
      dest: 'mark_to_add'
    , help: 'add user to group'
    , action: 'append'
    , defaultValue: []
    , type: 'string'
    }
  }
, {
    args: [ '-G', '--no-group' ]
  , options: {
      dest: 'mark_to_remove'
    , help: 'remove user from group'
    , action: 'append'
    , defaultValue: []
    , type: 'string'
    }
  }
, {
    args: [ '-u', '--user' ]
  , options: {
      help: 'target user'
    , type: 'string'
    , required: true
    }
  }
, {
    args: [ '-p', '--pass' ]
  , options: {
      help: 'user passsword. required only for add command'
    , type: 'string'
    }
  }
, {
    args: [ '-e', '--email' ]
  , options: {
      help: 'user email. required only for add command'
    , type: 'string'
    }
  }
];


module.exports.run = function (N, args, callback) {

  N.wire.emit('init:models', N, function (err) {
    if (err) {
      callback(err);
      return;
    }

    var user     = null
      , toAdd    = {}
      , toRemove = [];

    // FIXME check toRemove and toAdd intersection
    async.series([
      // fetch usergroups
      function (next) {
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
      }

      // find or create user
    , function (next) {
        // FIXME test existing login and email
        var User = N.models.users.User;
        var auth = new N.models.users.AuthLink();

        if ('add' === args.action) {
          // FIXME user revalidator for pass and email test
          if (!args.pass || !args.email) {
            next('Invalid password or email');
            return;
          }

          user = new User({
            nick: args.user,
            joined_ts: new Date()
          });

          user.save(function (err) {
            if (err) {
              next(err);
              return;
            }

            var provider = auth.providers.create({
              'type': 'plain'
            , 'email': args.email
            });

            provider.setPass(args.pass, function (err) {
              if (err) {
                next(err);
                return;
              }

              auth.user_id = user._id;
              auth.providers.push(provider);

              auth.save(next);
            });
          });

          return;
        }

        User.findOne({ nick: args.user }).exec(function (err, doc) {
          if (err) {
            next(err);
            return;
          }
          if (!user) {
            next('User not found, check name or use `add`');
          }
          user = doc;
          next();
        });
      }

      // update groups
    , function (next) {
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
        user.save(next);
      }
    ], function (err) {
      if (err) {
        callback('User creation error: ' + String(err.message || err));
        return;
      }

      /*eslint no-console:0*/
      console.log('OK\n');
      process.exit(0);
    });
  });
};
