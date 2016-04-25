// Show dialogs list
//
'use strict';


const DIALOGS_PER_PAGE = 50;


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    dialog_id: { format: 'mongo', required: false }
  });


  let buildDialogsIds = require('./list/_build_dialogs_ids_by_range')(N);

  function buildDialogsIdsAndGetOffset(env) {
    env.data.select_dialogs_start  = null;
    env.data.select_dialogs_before = DIALOGS_PER_PAGE;
    env.data.select_dialogs_after  = DIALOGS_PER_PAGE;

    if (env.params.dialog_id) {
      return N.models.users.Dialog.findOne()
                .where('_id').equals(env.params.dialog_id)
                .where('user_id').equals(env.user_info.user_id)
                .where('exists').equals(true)
                .select('last_message')
                .lean(true)
                .then(dlg => {
                  if (dlg) {
                    env.data.select_dialogs_start = dlg.last_message;
                  }
                })
                .then(() => buildDialogsIds(env));
    }

    return buildDialogsIds(env);
  }


  // Subcall users.dialog_list
  //
  N.wire.on(apiPath, function subcall_dialogs_list(env) {
    env.data.build_dialogs_ids = buildDialogsIdsAndGetOffset;

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


  // Fill head meta
  //
  N.wire.after(apiPath, function fill_head(env) {
    env.res.head = env.res.head || {};
    env.res.head.title = env.t('title', { user: env.user_info.user_name });
  });


  // Fill breadcrumbs
  //
  N.wire.after(apiPath, function fill_breadcrumbs(env) {
    env.data.breadcrumbs = env.data.breadcrumbs || [];

    env.data.breadcrumbs.push({
      text: env.user_info.user_name,
      route: 'users.member',
      params: { user_hid: env.user_info.user_hid },
      user_id: env.user_info.user_id,
      avatar_id: env.user_info.user_avatar,
      show_avatar: true
    });

    env.data.breadcrumbs.push({
      text: env.t('breadcrumbs_title'),
      route: 'users.dialogs_root'
    });

    env.res.breadcrumbs = env.data.breadcrumbs;
  });
};
