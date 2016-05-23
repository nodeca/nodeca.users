// Reflection helper for `internal:users.dialog_list`:
//
// 1. Builds IDs of dialogs to fetch for current page
// 2. Creates pagination info
//
// In:
//
// - env.user_info.user_id
// - env.data.select_dialogs_before
// - env.data.select_dialogs_after
// - env.data.select_dialogs_start
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


const Promise = require('bluebird');
const _       = require('lodash');
const co      = require('bluebird-co').co;


module.exports = function (N) {

  return co.wrap(function* buildDialogsIds(env) {

    function select_visible_before() {
      if (env.data.select_dialogs_before <= 0) return Promise.resolve([]);

      // first page, don't need to fetch anything
      if (!env.data.select_dialogs_start) return Promise.resolve([]);

      return N.models.users.Dialog.find()
                .where('user').equals(env.user_info.user_id)
                .where('exists').equals(true)
                .where('last_message').gt(env.data.select_dialogs_start)
                .sort('last_message')
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
          query = query.where('last_message').lte(env.data.select_dialogs_start);
          count++;
        } else {
          query = query.where('last_message').lt(env.data.select_dialogs_start);
        }
      }

      return query
              .where('user').equals(env.user_info.user_id)
              .where('exists').equals(true)
              .sort('-last_message')
              .select('_id')
              .limit(count)
              .lean(true)
              .then(dlgs => _.map(dlgs, '_id'));
    }


    // Run both functions in parallel and concatenate results
    //
    let results = yield [ select_visible_before(), select_visible_after() ];

    env.data.dialogs_ids = Array.prototype.concat.apply([], results);
  });
};
