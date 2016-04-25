// Get a specified amount of dialogs before or after a dialog with given last message id
//
'use strict';


const LIMIT = 50; // max topics to fetch before and after
const DIALOGS_PER_PAGE = 50;


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    last_message_id: { format: 'mongo', required: true },
    before:          { type: 'integer', minimum: 0, maximum: LIMIT, required: true },
    after:           { type: 'integer', minimum: 0, maximum: LIMIT, required: true }
  });


  let buildDialogsIds = require('./_build_dialogs_ids_by_range')(N);


  // Subcall users.dialog_list
  //
  N.wire.on(apiPath, function subcall_dialogs_list(env) {
    env.data.select_dialogs_start  = env.params.last_message_id;
    env.data.select_dialogs_before = env.params.before;
    env.data.select_dialogs_after  = env.params.after;
    env.data.build_dialogs_ids = buildDialogsIds;

    return N.wire.emit('internal:users.dialog_list', env);
  });


  // Fill pagination
  //
  N.wire.after(apiPath, function* fill_pagination(env) {
    let dialogs_total = yield N.models.users.Dialog
                                  .where('user_id').equals(env.user_info.user_id)
                                  .where('exists').equals(true)
                                  .count();

    let dialog_offset = 0;

    // Count an amount of visible dialogs before the first one
    if (env.data.dialogs.length) {
      dialog_offset = yield N.models.users.Dialog
                                .where('user_id').equals(env.user_info.user_id)
                                .where('exists').equals(true)
                                .where('last_message').gt(env.data.dialogs[0].last_message)
                                .count();
    }

    env.res.pagination = {
      total:        dialogs_total,
      per_page:     DIALOGS_PER_PAGE,
      chunk_offset: dialog_offset
    };
  });
};
