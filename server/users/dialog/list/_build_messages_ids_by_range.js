// Reflection helper for `internal:users.message_list`:
//
// 1. Builds IDs of messages to fetch for current page
// 2. Creates pagination info
//
// In:
//
// - env.user_info.user_id
// - env.data.dialog
// - env.data.select_messages_before
// - env.data.select_messages_after
// - env.data.select_messages_start
//
// Out:
//
// - env.data.messages_ids
//
// Needed in:
//
// - `users/dialog/list/by_range.js`
// - `users/dialog/dialog.js`
//
'use strict';


const _  = require('lodash');
const co = require('bluebird-co').co;


module.exports = function (N) {

  return co.wrap(function* buildDialogsIds(env) {

    function select_visible_before() {
      if (env.data.select_messages_before <= 0) return Promise.resolve([]);

      // first page, don't need to fetch anything
      if (!env.data.select_messages_start) return Promise.resolve([]);

      return N.models.users.DlgMessage.find()
                .where('dialog_id').equals(env.data.dialog._id)
                .where('exists').equals(true)
                .where('_id').gt(env.data.select_messages_start)
                .sort('_id')
                .select('_id')
                .limit(env.data.select_messages_before)
                .lean(true)
                .then(msgs => _.map(msgs, '_id').reverse());
    }


    function select_visible_after() {
      let count = env.data.select_messages_after;

      if (env.data.select_messages_after <= 0) return Promise.resolve([]);

      let query = N.models.users.DlgMessage.find();

      if (env.data.select_messages_start) {
        if (env.data.select_messages_after > 0 && env.data.select_messages_before > 0) {
          // if we're selecting both `after` and `before`, include current message
          // in the result, otherwise don't
          query = query.where('_id').lte(env.data.select_messages_start);
          count++;
        } else {
          query = query.where('_id').lt(env.data.select_messages_start);
        }
      }

      return query
              .where('dialog_id').equals(env.data.dialog._id)
              .where('exists').equals(true)
              .sort('-_id')
              .select('_id')
              .limit(count)
              .lean(true)
              .then(msgs => _.map(msgs, '_id'));
    }


    // Run both functions in parallel and concatenate results
    //
    let results = yield [ select_visible_before(), select_visible_after() ];

    env.data.messages_ids = Array.prototype.concat.apply([], results);
  });
};
