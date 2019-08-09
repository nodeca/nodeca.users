// Get bookmark list with all data needed to render
//
// in:
//
// - env.data.select_bookmarks_before (Number)  - amount of bookmarks before current
// - env.data.select_bookmarks_after (Number)   - amount of bookmarks after current
// - env.data.select_bookmarks_start (ObjectId) - last bookmark id to count from
//
// out:
//
//   env:
//     res:
//       items: ...
//       reached_top: ...
//       reached_bottom: ...
//     data:
//       users: ...
//

'use strict';


module.exports = function (N, apiPath) {

  // Set up default values
  //
  N.wire.before(apiPath, function init_bookmarks(env) {
    env.res.reached_top    = true;
    env.res.reached_bottom = true;
  });


  // Fetch bookmarks up
  //
  N.wire.on(apiPath, async function fetch_bookmarks_before(env) {
    if (!env.data.select_bookmarks_before) return;

    let start = env.data.select_bookmarks_start, query;

    do {
      query = N.models.users.Bookmark.findOne()
                  .where('user').equals(env.data.user._id)
                  .where('public').equals(true)
                  .select('_id')
                  .sort('_id')
                  .skip(env.data.select_bookmarks_before - 1)
                  .limit(1);

      if (env.data.select_bookmarks_after && start === env.data.select_bookmarks_start) {
        // if selecting both before and after, current post should be included in the range
        query = start ? query.where('_id').gte(start) : query;
      } else {
        query = start ? query.where('_id').gt(start) : query;
      }

      let last_bookmark = await query.lean(true);

      query = N.models.users.Bookmark.find()
                  .where('user').equals(env.data.user._id)
                  .sort('-_id');

      if (env.data.select_bookmarks_after && start === env.data.select_bookmarks_start) {
        // if selecting both before and after, current post should be included in the range
        query = start ? query.where('_id').gte(start) : query;
      } else {
        query = start ? query.where('_id').gt(start) : query;
      }

      query = last_bookmark ? query.where('_id').lte(last_bookmark._id) : query;

      let bookmarks = await query.lean(true);

      let sub_env = {
        params: {
          bookmarks,
          user_info: env.user_info
        },
        results: [],
        users: []
      };

      await N.wire.emit('internal:users.bookmarks.fetch', sub_env);

      start          = last_bookmark ? last_bookmark._id : null;
      env.data.users = (env.data.users || []).concat(sub_env.users);
      env.res.items  = sub_env.results.filter(Boolean).concat(env.res.items || []);
    } while (start && env.res.items.length < env.data.select_bookmarks_after);

    env.res.reached_top = !start;
  });


  // Fetch bookmarks down
  //
  N.wire.on(apiPath, async function fetch_bookmarks_after(env) {
    if (!env.data.select_bookmarks_after) return;

    let start = env.data.select_bookmarks_start, query;

    do {
      query = N.models.users.Bookmark.findOne()
                  .where('user').equals(env.data.user._id)
                  .where('public').equals(true)
                  .select('_id')
                  .sort('-_id')
                  .skip(env.data.select_bookmarks_after - 1)
                  .limit(1);

      query = start ? query.where('_id').lt(start) : query;

      let last_bookmark = await query.lean(true);

      query = N.models.users.Bookmark.find()
                  .where('user').equals(env.data.user._id)
                  .sort('-_id');

      query = start ? query.where('_id').lt(start) : query;
      query = last_bookmark ? query.where('_id').gte(last_bookmark._id) : query;

      let bookmarks = await query.lean(true);

      let sub_env = {
        params: {
          bookmarks,
          user_info: env.user_info
        },
        results: [],
        users: []
      };

      await N.wire.emit('internal:users.bookmarks.fetch', sub_env);

      start          = last_bookmark ? last_bookmark._id : null;
      env.data.users = (env.data.users || []).concat(sub_env.users);
      env.res.items  = (env.res.items || []).concat(sub_env.results.filter(Boolean));
    } while (start && env.res.items.length < env.data.select_bookmarks_after);

    env.res.reached_bottom = !start;
  });
};
