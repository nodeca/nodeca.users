// Collect urls to include in sitemap
//

'use strict';

const stream   = require('stream');


module.exports = function (N, apiPath) {

  N.wire.on(apiPath, function get_users_sitemap(data) {
    let user_stream = new stream.Transform({
      objectMode: true,
      transform(user, encoding, callback) {
        this.push({
          loc: N.router.linkTo('users.member', {
            user_hid: user.hid
          }),
          lastmod: user.last_active_ts
        });

        callback();
      }
    });

    stream.pipeline(
      N.models.users.User.find()
          .where('exists').equals(true)
          .select('hid last_active_ts')
          .sort('hid')
          .lean(true)
          .cursor(),

      user_stream,
      () => {}
    );

    data.streams.push({ name: 'users', stream: user_stream });
  });
};
