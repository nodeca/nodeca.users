'use strict';


const prompt  = require('prompt');


module.exports = async function (N) {

  let user         = new N.models.users.User();
  let authProvider = new N.models.users.AuthProvider();

  prompt.message   = '';
  prompt.delimiter = '';
  prompt.start();

  var schema = [
    { name: 'login', description: 'Administrator login? (admin)' },
    { name: 'password', description: 'Administrator password? (admin)', hidden: true }
  ];

  let result = await new Promise((resolve, reject) => {
    prompt.get(schema, err => (err ? reject(err) : resolve()));
  });

  let login = result.login || 'admin';
  let password = result.password || 'admin';
  let email = 'admin@example.com';

  // create admin user

  let adminGroupId = await N.models.users.UserGroup.findIdByName('administrators');

  user.nick = login;
  user.email = email;
  user.joined_ts = new Date();
  user.post_count = 1;
  user.usergroups = [ adminGroupId ];

  user.first_name = 'Admin';
  user.last_name = 'Adminovski';

  await user.save();

  // create auth link

  authProvider.type = 'plain';
  authProvider.email = email;

  await authProvider.setPass(password);

  authProvider.user = user._id;
  authProvider.ip = '127.0.0.1';
  authProvider.last_ip = '127.0.0.1';

  await authProvider.save();
};
