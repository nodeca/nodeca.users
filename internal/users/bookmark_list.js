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


const _ = require('lodash');


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

    let start = env.data.select_bookmarks_start, query, users = [];

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

      let content_type_from_int = _.invert(_.get(N, 'shared.content_type', {}));
      let results = new Array(bookmarks.length).fill(null);

      await Promise.all(_.uniq(_.map(bookmarks, 'src_type')).map(async type => {
        if (!content_type_from_int[type]) return;

        let content_type = content_type_from_int[type].toLowerCase();

        let sub_env = {
          params: {
            bookmarks: bookmarks.filter(bookmark => bookmark.src_type === type),
            user_info: env.user_info
          },
          sandbox: {}
        };

        await N.wire.emit('internal:users.bookmarks.' + content_type, sub_env);

        if (!sub_env.results) return;

        let results_by_id = _.keyBy(sub_env.results, '_id');

        for (let [ idx, bookmark ] of Object.entries(bookmarks)) {
          if (results_by_id[bookmark._id]) {
            results[idx] = results_by_id[bookmark._id];
          }
        }

        for (let user_id of sub_env.users) users.push(user_id);
      }));

      start          = last_bookmark ? last_bookmark._id : null;
      env.data.users = (env.data.users || []).concat(users);
      env.res.items  = results.filter(Boolean).concat(env.res.items || []);
    } while (start && env.res.items.length < env.data.select_bookmarks_after);

    env.res.reached_top = !start;
  });


  // Fetch bookmarks down
  //
  N.wire.on(apiPath, async function fetch_bookmarks_after(env) {
    if (!env.data.select_bookmarks_after) return;

    let start = env.data.select_bookmarks_start, query, users = [];

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

      let content_type_from_int = _.invert(_.get(N, 'shared.content_type', {}));
      let results = new Array(bookmarks.length).fill(null);

      await Promise.all(_.uniq(_.map(bookmarks, 'src_type')).map(async type => {
        if (!content_type_from_int[type]) return;

        let content_type = content_type_from_int[type].toLowerCase();

        let sub_env = {
          params: {
            bookmarks: bookmarks.filter(bookmark => bookmark.src_type === type),
            user_info: env.user_info
          },
          sandbox: {}
        };

        await N.wire.emit('internal:users.bookmarks.' + content_type, sub_env);

        if (!sub_env.results) return;

        let results_by_id = _.keyBy(sub_env.results, '_id');

        for (let [ idx, bookmark ] of Object.entries(bookmarks)) {
          if (results_by_id[bookmark._id]) {
            results[idx] = results_by_id[bookmark._id];
          }
        }

        for (let user_id of sub_env.users) users.push(user_id);
      }));

      start          = last_bookmark ? last_bookmark._id : null;
      env.data.users = (env.data.users || []).concat(users);
      env.res.items  = (env.res.items || []).concat(results.filter(Boolean));
    } while (start && env.res.items.length < env.data.select_bookmarks_after);

    env.res.reached_bottom = !start;
  });
};
