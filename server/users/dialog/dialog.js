// Show dialogs list
//
'use strict';


const mongoose      = require('mongoose');


const MESSAGES_PER_PAGE = 50;


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    dialog_id:  { format: 'mongo', required: true },
    message_id: { format: 'mongo', required: false }
  });


  let buildMessagesIds = require('./list/_build_messages_ids_by_range')(N);


  // Redirect guests to login page
  //
  N.wire.before(apiPath, async function force_login_guest(env) {
    await N.wire.emit('internal:users.force_login_guest', env);
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


  // Fetch dialog owner (used in breadcrumbs)
  //
  N.wire.after(apiPath, async function fetch_user(env) {
    env.data.user = await N.models.users.User.findById(env.data.dialog.user)
                              .lean(true);
  });


  // Fetch recipient
  //
  N.wire.after(apiPath, async function fetch_recipient(env) {
    env.data.to = await N.models.users.User.findById(env.data.dialog.with)
                            .lean(true);
  });


  // Check if we can send a message to that user
  //
  N.wire.after(apiPath, async function fill_dialog_permissions(env) {
    // can't send messages to deleted users
    if (!env.data.to || !env.data.to.exists) return;

    let settings = await env.extras.settings.fetch([
      'can_use_dialogs',
      'can_create_dialogs'
    ]);

    let recipient_can_use_dialogs = await N.settings.get('can_use_dialogs', {
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
  N.wire.after(apiPath, async function fill_pagination(env) {
    let messages_total = await N.models.users.DlgMessage
                                  .where('parent').equals(env.data.dialog._id)
                                  .where('exists').equals(true)
                                  .countDocuments();

    let message_offset = 0;

    // Count an amount of visible dialogs before the first one
    if (env.data.messages.length) {
      message_offset = await N.models.users.DlgMessage
                                .where('parent').equals(env.data.dialog._id)
                                .where('exists').equals(true)
                                .where('_id').gt(env.data.messages[0]._id)
                                .countDocuments();
    }

    env.res.pagination = {
      total:        messages_total,
      per_page:     MESSAGES_PER_PAGE,
      chunk_offset: message_offset
    };
  });


  // Mark dialog as read
  //
  N.wire.after(apiPath, async function mark_read(env) {
    let result = await N.models.users.Dialog.updateOne({ _id: env.data.dialog._id }, { unread: false });

    env.data.unread_modified = (result.nModified !== 0);
  });


  // Mark dialogs as visited
  //
  N.wire.after(apiPath, async function mark_dialogs_visited(env) {
    // no need to do anything if user browses old messages
    if (!env.data.unread_modified) return;

    let unread = await N.models.users.DlgUnread.findOne()
                           .where('user').equals(env.data.dialog.user)
                           .lean(true);

    let any_unread_dialog = N.models.users.Dialog.findOne()
                                .where('user').equals(env.data.dialog.user)
                                .where('exists').equals(true)
                                .where('unread').equals(true)
                                .select('cache.last_message -_id')
                                .lean(true);

    if (unread) {
      let start = new mongoose.Types.ObjectId(Math.floor(unread.last_read / 1000));
      any_unread_dialog = any_unread_dialog.where('cache.last_message').gt(start);
    }

    if (await any_unread_dialog) return;

    await N.models.users.DlgUnread.set_last_read(env.data.dialog.user);
  });


  // Fill head meta
  //
  N.wire.after(apiPath, function fill_head(env) {
    env.res.head = env.res.head || {};
    env.res.head.title = env.t('title', { nick: (env.data.to || {}).name || '' });
  });


  // Fill breadcrumbs
  //
  N.wire.after(apiPath, async function fill_breadcrumbs(env) {
    env.data.breadcrumbs = env.data.breadcrumbs || [];

    await N.wire.emit('internal:users.breadcrumbs.fill_root', env);

    env.data.breadcrumbs.push({
      text: env.t('breadcrumbs_title'),
      route: 'users.dialogs_root',
      params: { user_hid: env.user_info.user_hid }
    });

    env.res.breadcrumbs = env.data.breadcrumbs;
  });
};
