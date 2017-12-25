// Collect urls to include in sitemap
//

'use strict';

const pumpify  = require('pumpify');
const through2 = require('through2');


module.exports = function (N, apiPath) {

  N.wire.on(apiPath, function get_users_sitemap(data) {
    let stream = pumpify.obj(
      N.models.users.User.collection
                         .find({ exists: true }, { hid: 1, last_active_ts: 1 })
                         .sort({ hid: 1 })
                         .stream(),

      through2.obj(function (user, encoding, callback) {
        this.push({
          loc: N.router.linkTo('users.member', {
            user_hid: user.hid
          }),
          lastmod: user.last_active_ts
        });

        callback();
      })
    );

    data.streams.push({ name: 'users', stream });
  });
};
