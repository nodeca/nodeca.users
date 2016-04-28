// Get a specified amount of messages before or after a message with given _id
//
'use strict';


const LIMIT = 50; // max topics to fetch before and after
const MESSAGES_PER_PAGE = 50;


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    dialog_id:       { format: 'mongo', required: true },
    last_message_id: { format: 'mongo', required: true },
    before:          { type: 'integer', minimum: 0, maximum: LIMIT, required: true },
    after:           { type: 'integer', minimum: 0, maximum: LIMIT, required: true }
  });


  let buildMessagesIds = require('./_build_messages_ids_by_range')(N);


  // Subcall users.dialog_list
  //
  N.wire.on(apiPath, function subcall_dialogs_list(env) {
    env.data.dialog_id              = env.params.dialog_id;
    env.data.select_messages_start  = env.params.last_message_id;
    env.data.select_messages_before = env.params.before;
    env.data.select_messages_after  = env.params.after;
    env.data.build_messages_ids     = buildMessagesIds;

    return N.wire.emit('internal:users.message_list', env);
  });


  // Fill pagination (progress)
  //
  N.wire.after(apiPath, function* fill_pagination(env) {
    let messages_total = yield N.models.users.DlgMessage
                                  .where('parent').equals(env.data.dialog._id)
                                  .where('exists').equals(true)
                                  .count();

    let message_offset = 0;

    // Count an amount of visible dialogs before the first one
    if (env.data.messages.length) {
      message_offset = yield N.models.users.DlgMessage
                                .where('parent').equals(env.data.dialog._id)
                                .where('exists').equals(true)
                                .where('_id').gt(env.data.messages[0]._id)
                                .count();
    }

    env.res.pagination = {
      total:        messages_total,
      per_page:     MESSAGES_PER_PAGE,
      chunk_offset: message_offset
    };
  });
};
