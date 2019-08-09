// Get a bookmark range defined by an item id in the middle and an amount
// of item before or after it
//

'use strict';

// Max item to fetch before and after
const LIMIT = 50;


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid:    { type: 'integer', minimum: 1, required: true },
    start:       { format: 'mongo', required: true },
    before:      { type: 'integer', required: true, minimum: 0, maximum: LIMIT },
    after:       { type: 'integer', required: true, minimum: 0, maximum: LIMIT }
  });


  // Fetch owner
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env) {
    return N.wire.emit('internal:users.fetch_user_by_hid', env);
  });


  // Forbid access to pages owned by bots
  //
  N.wire.before(apiPath, async function bot_member_pages_forbid_access(env) {
    let is_bot = await N.settings.get('is_bot', {
      user_id: env.data.user._id,
      usergroup_ids: env.data.user.usergroups
    }, {});

    if (is_bot) throw N.io.NOT_FOUND;
  });


  // Get user bookmark list
  //
  N.wire.on(apiPath, async function user_bookmarks(env) {
    env.data.select_bookmarks_start  = env.params.start;
    env.data.select_bookmarks_before = env.params.before;
    env.data.select_bookmarks_after  = env.params.after;

    await N.wire.emit('internal:users.bookmark_list', env);

    env.res.user_hid = env.data.user.hid;
  });
};
