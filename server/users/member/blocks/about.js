// Fill about block stub
//
'use strict';


const _ = require('lodash');


module.exports = function (N) {

  // Fill contacts
  //
  N.wire.after('server:users.member', function fill_contacts(env) {
    _.set(env.res, 'blocks.about.list', [
      { name: 'joined', value: env.helpers.date(env.data.user.joined_ts, 'datetime') },
      { name: 'post_count', value: 245, link: '#' },
      { name: 'location', value: 'saint-petersburg', link: '#' },
      { name: 'email', value: 'email@example.com', link: 'mailto:email@example.com' }
    ]);

    _.set(env.res, 'blocks.about.extra', [
      { name: 'skype', value: 'skype_is_good', link: 'callto:skype_is_good' },
      { name: 'jabber', value: 'jabber@example.com', link: '#' },
      { name: 'birthday', value: '23 Feb 1083' },
      { name: 'hobbies', value: 'Music, Books, Football, Tennis' }
    ]);
  });
};
