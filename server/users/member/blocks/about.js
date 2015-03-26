// Fill about block stub
//
'use strict';


module.exports = function (N) {

  // Fill contacts
  //
  N.wire.after('server:users.member', function fill_contacts(env) {
    env.res.blocks.about = env.res.blocks.about || {};

    env.res.blocks.about.messengers = N.config.users.messengers;

    env.res.blocks.about.contacts = [
      { messenger: 'skype', value: 'skype_login_example' },
      { messenger: 'icq', value: '111111111' },
      { messenger: 'hangout', value: 'hangout@example.com' },
      { messenger: 'jabber', value: 'jabber@example.com' },
      { messenger: 'email', value: 'email@example.com' }
    ];
  });
};
