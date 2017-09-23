// Show dialogs list
//
'use strict';


const DIALOGS_PER_PAGE = 50;


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid:  { type: 'integer', minimum: 1, required: true },
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
                .where('user').equals(env.data.user._id)
                .where('exists').equals(true)
                .select('cache.last_message')
                .lean(true)
                .then(dlg => {
                  if (dlg) {
                    env.data.select_dialogs_start = dlg.cache.last_message;
                  }
                })
                .then(() => buildDialogsIds(env));
    }

    return buildDialogsIds(env);
  }


  // Redirect guests to login page
  //
  N.wire.before(apiPath, async function force_login_guest(env) {
    await N.wire.emit('internal:users.force_login_guest', env);
  });


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


  // Fetch "hide answered dialogs" setting
  //
  N.wire.on(apiPath, async function fetch_filter_setting(env) {
    let store = N.settings.getStore('user');

    let setting = await store.get(
      'dialogs_hide_answered',
      { user_id: env.user_info.user_id }
    );

    env.data.dialogs_hide_answered = !!setting.value;
    env.res.dialogs_hide_answered  = !!setting.value;
  });


  // Subcall users.dialog_list
  //
  N.wire.on(apiPath, function subcall_dialogs_list(env) {
    env.data.build_dialogs_ids = buildDialogsIdsAndGetOffset;

    return N.wire.emit('internal:users.dialog_list', env);
  });


  // Fill pagination (progress)
  //
  N.wire.after(apiPath, async function fill_pagination(env) {
    let query = N.models.users.Dialog
                    .where('user').equals(env.data.user._id)
                    .where('exists').equals(true);

    if (env.data.dialogs_hide_answered) query = query.where('cache.is_reply').equals(false);

    let dialogs_total = await query.count();

    let dialog_offset = 0;

    // Count an amount of visible dialogs before the first one
    if (env.data.dialogs.length) {
      let query = N.models.users.Dialog
                      .where('user').equals(env.data.user._id)
                      .where('exists').equals(true)
                      .where('cache.last_message').gt(env.data.dialogs[0].cache.last_message);

      if (env.data.dialogs_hide_answered) query = query.where('cache.is_reply').equals(false);

      dialog_offset = await query.count();
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
    env.res.head.title = env.t('title', { user: env.data.user.name });
  });


  // Fill breadcrumbs
  //
  N.wire.after(apiPath, async function fill_breadcrumbs(env) {
    env.data.breadcrumbs = env.data.breadcrumbs || [];

    await N.wire.emit('internal:users.breadcrumbs.fill_root', env);

    env.data.breadcrumbs.push({
      text: env.t('breadcrumbs_title'),
      route: 'users.dialogs_root',
      params: { user_hid: env.data.user.hid }
    });

    env.res.breadcrumbs = env.data.breadcrumbs.slice(0, -1);
  });


  // Fill response
  //
  N.wire.after(apiPath, function fill_response(env) {
    env.res.user_hid = env.data.user.hid;
  });
};
