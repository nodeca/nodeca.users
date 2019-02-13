// Get a specified amount of dialogs before or after a dialog with given last message id
//
'use strict';


const LIMIT = 50; // max topics to fetch before and after
const DIALOGS_PER_PAGE = 50;


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    last_message_id: { format: 'mongo', required: true },
    hide_answered:   { type: 'boolean', required: true },
    user_hid:        { type: 'integer', minimum: 1, required: true },
    before:          { type: 'integer', minimum: 0, maximum: LIMIT, required: true },
    after:           { type: 'integer', minimum: 0, maximum: LIMIT, required: true }
  });


  let buildDialogsIds = require('./_build_dialogs_ids_by_range')(N);


  // Fetch member by 'user_hid'
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env) {
    return N.wire.emit('internal:users.fetch_user_by_hid', env);
  });


  // Check permissions
  //
  N.wire.before(apiPath, function check_permissions(env) {
    if (env.user_info.user_id !== String(env.data.user._id)) {
      return N.io.FORBIDDEN;
    }
  });


  // Subcall users.dialog_list
  //
  N.wire.on(apiPath, function subcall_dialogs_list(env) {
    env.data.select_dialogs_start  = env.params.last_message_id;
    env.data.select_dialogs_before = env.params.before;
    env.data.select_dialogs_after  = env.params.after;
    env.data.dialogs_hide_answered = env.params.hide_answered;
    env.data.build_dialogs_ids     = buildDialogsIds;

    return N.wire.emit('internal:users.dialog_list', env);
  });


  // Fill pagination (progress)
  //
  N.wire.after(apiPath, async function fill_pagination(env) {
    let query = N.models.users.Dialog
                    .where('user').equals(env.user_info.user_id)
                    .where('exists').equals(true);

    if (env.data.dialogs_hide_answered) query = query.where('cache.is_reply').equals(false);

    let dialogs_total = await query.countDocuments();

    let dialog_offset = 0;

    // Count an amount of visible dialogs before the first one
    if (env.data.dialogs.length) {
      let query = N.models.users.Dialog
                      .where('user').equals(env.user_info.user_id)
                      .where('exists').equals(true)
                      .where('cache.last_message').gt(env.data.dialogs[0].cache.last_message);

      if (env.data.dialogs_hide_answered) query = query.where('cache.is_reply').equals(false);

      dialog_offset = await query.countDocuments();
    }

    env.res.pagination = {
      total:        dialogs_total,
      per_page:     DIALOGS_PER_PAGE,
      chunk_offset: dialog_offset
    };
  });
};
