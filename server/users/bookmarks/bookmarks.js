// Shows all bookmarks made by a user


'use strict';


const ITEMS_PER_PAGE = 30;


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid: { type: 'integer', minimum: 1, required: true },
    start:    { format: 'mongo', required: false }
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
    if (env.params.start) {
      // show the middle of the page, with some items before and after
      env.data.select_bookmarks_start  = env.params.start;
      env.data.select_bookmarks_before = Math.ceil(ITEMS_PER_PAGE / 2);
      env.data.select_bookmarks_after  = ITEMS_PER_PAGE;
    } else {
      // show first page
      env.data.select_bookmarks_start  = null;
      env.data.select_bookmarks_before = 0;
      env.data.select_bookmarks_after  = ITEMS_PER_PAGE;
    }

    await N.wire.emit('internal:users.bookmark_list', env);

    env.res.user_hid = env.data.user.hid;
    env.res.items_per_page = ITEMS_PER_PAGE;
  });


  // Fill head meta
  //
  N.wire.after(apiPath, function fill_head(env) {
    let user = env.data.user;

    env.res.head = env.res.head || {};
    env.res.head.title = env.t('title_with_user', { user: env.user_info.is_member ? user.name : user.nick });
  });


  // Fill breadcrumbs
  //
  N.wire.after(apiPath, async function fill_breadcrumbs(env) {
    await N.wire.emit('internal:users.breadcrumbs.fill_albums', env);

    env.res.breadcrumbs = env.data.breadcrumbs.slice(0, -1);
  });
};
