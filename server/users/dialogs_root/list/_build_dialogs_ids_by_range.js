// Reflection helper for `internal:users.dialog_list`:
//
// 1. Builds IDs of dialogs to fetch for current page
// 2. Creates pagination info
//
// In:
//
// - env.data.user
// - env.data.select_dialogs_before
// - env.data.select_dialogs_after
// - env.data.select_dialogs_start
// - env.data.dialogs_hide_answered
//
// Out:
//
// - env.data.dialogs_ids
//
// Needed in:
//
// - `users/dialogs_root/list/by_range.js`
// - `users/dialogs_root/dialogs_root.js`
//
'use strict';


const _       = require('lodash');
const Promise = require('bluebird');


module.exports = function (N) {

  return Promise.coroutine(function* buildDialogsIds(env) {

    function select_visible_before() {
      if (env.data.select_dialogs_before <= 0) return Promise.resolve([]);

      // first page, don't need to fetch anything
      if (!env.data.select_dialogs_start) return Promise.resolve([]);


      let query = N.models.users.Dialog.find();

      if (env.data.dialogs_hide_answered) {
        query = query.where('cache.is_reply').equals(false);
      }

      return query
              .where('user').equals(env.data.user._id)
              .where('exists').equals(true)
              .where('cache.last_message').gt(env.data.select_dialogs_start)
              .sort('cache.last_message')
              .select('_id')
              .limit(env.data.select_dialogs_before)
              .lean(true)
              .then(dlgs => _.map(dlgs, '_id').reverse());
    }


    function select_visible_after() {
      let count = env.data.select_dialogs_after;

      if (env.data.select_dialogs_after <= 0) return Promise.resolve([]);

      let query = N.models.users.Dialog.find();

      if (env.data.select_dialogs_start) {
        if (env.data.select_dialogs_after > 0 && env.data.select_dialogs_before > 0) {
          // if we're selecting both `after` and `before`, include current dialog
          // in the result, otherwise don't
          query = query.where('cache.last_message').lte(env.data.select_dialogs_start);
          count++;
        } else {
          query = query.where('cache.last_message').lt(env.data.select_dialogs_start);
        }
      }

      if (env.data.dialogs_hide_answered) {
        query = query.where('cache.is_reply').equals(false);
      }

      return query
              .where('user').equals(env.data.user._id)
              .where('exists').equals(true)
              .sort('-cache.last_message')
              .select('_id')
              .limit(count)
              .lean(true)
              .then(dlgs => _.map(dlgs, '_id'));
    }


    // Run both functions in parallel and concatenate results
    //
    let results = yield Promise.all([ select_visible_before(), select_visible_after() ]);

    env.data.dialogs_ids = Array.prototype.concat.apply([], results);
  });
};
