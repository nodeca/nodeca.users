// Show dialogs list
//
'use strict';


const MESSAGES_PER_PAGE = 50;


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    dialog_id:  { format: 'mongo', required: true },
    message_id: { format: 'mongo', required: false }
  });


  let buildMessagesIds = require('./list/_build_messages_ids_by_range')(N);


  // Fetch user
  //
  N.wire.before(apiPath, function* fetch_user(env) {
    env.data.user = yield N.models.users.User.findOne({ _id: env.user_info.user_id });
  });


  // Subcall users.message_list
  //
  N.wire.on(apiPath, function subcall_dialogs_list(env) {
    env.data.dialog_id              = env.params.dialog_id;
    env.data.select_messages_start  = env.params.message_id;
    env.data.select_messages_before = MESSAGES_PER_PAGE;
    env.data.select_messages_after  = MESSAGES_PER_PAGE;
    env.data.build_messages_ids     = buildMessagesIds;

    return N.wire.emit('internal:users.message_list', env);
  });


  // Fetch recipient
  //
  N.wire.after(apiPath, function* fetch_recipient(env) {
    env.data.to = yield N.models.users.User.findOne()
                            .where('_id').equals(env.data.dialog.to)
                            .lean(true);
  });


  // Check if we can send a message to that user
  //
  N.wire.after(apiPath, function* fill_dialog_permissions(env) {
    let settings = yield env.extras.settings.fetch([
      'can_use_dialogs',
      'can_create_dialogs'
    ]);

    let recipient_can_use_dialogs = yield N.settings.get('can_use_dialogs', {
      user_id: env.data.to._id,
      usergroup_ids: env.data.to.usergroups
    }, {});

    if (settings.can_use_dialogs &&
        settings.can_create_dialogs &&
        recipient_can_use_dialogs) {

      env.res.can_create_dialog_with_user = true;
    }
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


  // Mark dialog as read
  //
  N.wire.after(apiPath, function* mark_read(env) {
    yield N.models.users.Dialog.update({ _id: env.data.dialog._id }, { unread: 0 });
  });


  // Fill head meta
  //
  N.wire.after(apiPath, function fill_head(env) {
    env.res.head = env.res.head || {};
    env.res.head.title = env.t('title', {
      dlg_title: env.data.dialog.title,
      user: env.user_info.user_name
    });
  });


  // Fill breadcrumbs
  //
  N.wire.after(apiPath, function* fill_breadcrumbs(env) {
    env.data.breadcrumbs = env.data.breadcrumbs || [];

    yield N.wire.emit('internal:users.breadcrumbs.fill_root', env);

    env.data.breadcrumbs.push({
      text: env.t('breadcrumbs_title'),
      route: 'users.dialogs_root',
      params: { user_hid: env.user_info.user_hid }
    });

    env.res.breadcrumbs = env.data.breadcrumbs;
  });
};
