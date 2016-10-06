'use strict';

const prompt  = require('prompt');
const Promise = require('bluebird');


module.exports = Promise.coroutine(function* (N) {

  let user     = new N.models.users.User();
  let authLink = new N.models.users.AuthLink();

  prompt.message   = '';
  prompt.delimiter = '';
  prompt.start();

  var schema = [
    { name: 'login', description: 'Administrator login? (admin)' },
    { name: 'password', description: 'Administrator password? (admin)', hidden: true }
  ];

  let result = yield Promise.fromCallback(cb => prompt.get(schema, cb));

  let login = result.login || 'admin';
  let password = result.password || 'admin';
  let email = 'admin@example.com';

  // create admin user

  let adminGroupId = yield N.models.users.UserGroup.findIdByName('administrators');

  user.nick = login;
  user.email = email;
  user.joined_ts = new Date();
  user.post_count = 1;
  user.usergroups = [ adminGroupId ];

  user.first_name = 'Admin';
  user.last_name = 'Adminovski';

  yield user.save();

  // create auth link

  authLink.type = 'plain';
  authLink.email = email;

  yield authLink.setPass(password);

  authLink.user = user._id;
  authLink.ip = '127.0.0.1';
  authLink.last_ip = '127.0.0.1';

  yield authLink.save();
});
