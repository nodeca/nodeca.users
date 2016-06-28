// Fill about block stub
//
'use strict';


var _ = require('lodash');


module.exports = function (N) {

  // Fill contacts
  //
  N.wire.after('server:users.member', function fill_contacts(env) {
    _.set(env.res, 'blocks.about.messengers', N.config.users.messengers);
    _.set(env.res, 'blocks.about.contacts', [
      { messenger: 'skype', value: 'skype_login_example' },
      { messenger: 'hangout', value: 'hangout@example.com' },
      { messenger: 'jabber', value: 'jabber@example.com' },
      { messenger: 'email', value: 'email@example.com' }
    ]);
  });
};
