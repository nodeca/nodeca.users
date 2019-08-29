// Show bookmarks created by the user
//
'use strict';


const _ = require('lodash');


module.exports = function (N) {

  const BOOKMARKS_LIMIT = 3;


  // Fetch bookmarks
  //
  N.wire.after('server:users.member', async function fetch_bookmarks(env) {
    env.data.select_bookmarks_after = BOOKMARKS_LIMIT;

    let sub_env = {
      user_info: env.user_info, // for sanitizing only
      data: {
        user: env.data.user,
        select_bookmarks_after: BOOKMARKS_LIMIT
      },
      res: {}
    };

    await N.wire.emit('internal:users.bookmark_list', sub_env);

    env.res.blocks = env.res.blocks || {};

    if (sub_env.res.items.length > 0) {
      _.set(env.res, 'blocks.bookmarks', {
        list: sub_env.res.items.slice(0, 3).map(({ title, url }) => ({ title, url }))
      });
    }
  });
};
