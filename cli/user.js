// Add new user or change password/groups of existing one via console.
//
'use strict';


const _       = require('lodash');
const Promise = require('bluebird');


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


module.exports.run = Promise.coroutine(function* (N, args) {

  yield N.wire.emit('init:models', N);

  let user = null;
  let toAdd = {};
  let toRemove = [];


  // check password and email
  //
  if (args.action === 'add' && !args.email) throw 'Email is required';
  if (args.action === 'add' && !args.pass) throw 'Password is required';

  // fetch usergroups
  //
  let UserGroup = N.models.users.UserGroup;
  let docs = yield UserGroup.find().select('_id short_name');

  docs.forEach(group => {
    if (args.mark_to_remove.indexOf(group.short_name) !== -1) {
      toRemove.push(group._id.toString());
    }
    if (args.mark_to_add.indexOf(group.short_name) !== -1) {
      toAdd[group._id.toString()] = group;
    }
  });


  // find or create user
  //
  let User = N.models.users.User;
  let doc = yield User.findOne({ nick: args.user });

  if (args.action === 'add') {
    if (doc) throw 'User with that name already exists';

    user = new User({
      nick: args.user,
      joined_ts: new Date(),
      joined_ip: '127.0.0.1'
    });
  } else {
    if (!doc) throw 'User not found, check name or use `add`';

    user = doc;
  }

  // set password
  //
  if (args.pass) {
    // disable all other passwords
    yield N.models.users.AuthProvider.update(
      { user: user._id, type: 'plain', exists: true },
      { $set: { exists: false } },
      { multi: true }
    );

    let authProvider = new N.models.users.AuthProvider();

    authProvider.type = 'plain';
    authProvider.email = args.email || user.email;

    yield authProvider.setPass(args.pass);

    authProvider.user = user._id;
    authProvider.ip = '127.0.0.1';
    authProvider.last_ip = '127.0.0.1';

    yield authProvider.save();
  }


  // set email and check that it's unique
  //
  if (args.email) {
    doc = yield User.findOne({ email: args.email });

    if (doc && String(doc._id) !== String(user._id)) throw 'User with that email already exists';

    user.email = args.email;
  }


  // validate and update usergroups
  //
  if (!_.isEmpty(toRemove) && !_.isEmpty(user.usergroups)) {
    user.usergroups = user.usergroups.filter(group => toRemove.indexOf(group.toString()) === -1);
  }
  if (!_.isEmpty(toAdd)) {
    // remove from toAdd list already assigned groups
    user.usergroups.forEach(group => {
      let group_id = group.toString();

      if (toAdd[group_id]) toAdd = _.without(toAdd, group_id);
    });

    if (!_.isEmpty(toAdd)) {
      _.values(toAdd).forEach(group => user.usergroups.push(group));
    }
  }

  yield user.save();

  yield N.wire.emit('exit.shutdown');
});
