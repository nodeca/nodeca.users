// Reply in dialog
//
'use strict';


const _ = require('lodash');
const $ = require('nodeca.core/lib/parser/cheequery');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    dialog_id:                { format: 'mongo', required: true },
    txt:                      { type: 'string', required: true },
    attach:                   {
      type: 'array',
      required: true,
      uniqueItems: true,
      items: { format: 'mongo', required: true }
    },
    option_no_mlinks:         { type: 'boolean', required: true },
    option_no_emojis:         { type: 'boolean', required: true },
    option_no_quote_collapse: { type: 'boolean', required: true }
  });


  // Check user permissions
  //
  N.wire.before(apiPath, async function check_permissions(env) {
    if (!env.user_info.is_member) return N.io.NOT_FOUND;

    let can_create_dialogs = await env.extras.settings.fetch('can_create_dialogs');

    if (!can_create_dialogs) throw N.io.FORBIDDEN;
  });


  // Fetch dialog
  //
  N.wire.before(apiPath, async function check_title_length(env) {
    env.data.dialog = await N.models.users.Dialog.findOne()
                                .where('_id').equals(env.params.dialog_id)
                                .where('user').equals(env.user_info.user_id)
                                .lean(true);

    if (!env.data.dialog) throw N.io.NOT_FOUND;
  });


  // Fetch to user
  //
  N.wire.before(apiPath, async function fetch_receiver(env) {
    env.data.to = await N.models.users.User.findOne()
                            .where('_id').equals(env.data.dialog.to)
                            .lean(true);

    if (!env.data.to || !env.data.to.exists) throw N.io.NOT_FOUND;
  });


  // Check if recipient is able to use dialogs
  //
  N.wire.before(apiPath, async function check_recipient_permissions(env) {
    let can_use_dialogs = await N.settings.get('can_use_dialogs', {
      user_id: env.data.to._id,
      usergroup_ids: env.data.to.usergroups
    }, {});

    if (!can_use_dialogs) {
      throw {
        code: N.io.CLIENT_ERROR,
        message: env.t('err_recipient_cant_use_dialogs')
      };
    }
  });


  // Check if people are ignoring each other
  //
  N.wire.before(apiPath, async function check_ignore(env) {
    let ignore_data;

    // Check if recipient ignores us (except for moderators)
    //
    ignore_data = await N.models.users.Ignore.findOne()
                            .where('from').equals(env.data.to._id)
                            .where('to').equals(env.user_info.user_id)
                            .lean(true);

    if (ignore_data) {
      let cannot_be_ignored = await env.extras.settings.fetch('cannot_be_ignored');

      if (!cannot_be_ignored) {
        throw {
          code: N.io.CLIENT_ERROR,
          message: env.t('err_sender_is_ignored')
        };
      }
    }

    // Check we ignoring recipient to make sure he can reply
    //
    ignore_data = await N.models.users.Ignore.findOne()
                            .where('to').equals(env.data.to._id)
                            .where('from').equals(env.user_info.user_id)
                            .lean(true);

    if (ignore_data) {
      throw {
        code: N.io.CLIENT_ERROR,
        message: env.t('err_recipient_is_ignored')
      };
    }
  });


  // Prepare parse options
  //
  N.wire.before(apiPath, async function prepare_options(env) {
    let settings = await N.settings.getByCategory(
      'dialogs_markup',
      { usergroup_ids: env.user_info.usergroups },
      { alias: true }
    );

    if (env.params.option_no_mlinks) {
      settings.link_to_title = false;
      settings.link_to_snippet = false;
    }

    if (env.params.option_no_emojis) {
      settings.emoji = false;
    }

    if (env.params.option_no_quote_collapse) {
      settings.quote_collapse = false;
    }

    env.data.parse_options = settings;
  });


  // Parse user input to HTML
  //
  N.wire.on(apiPath, async function parse_text(env) {
    env.data.parse_result = await N.parser.md2html({
      text: env.params.txt,
      attachments: env.params.attach,
      options: env.data.parse_options,
      user_info: env.user_info
    });
  });


  // Parse user input to preview
  //
  N.wire.after(apiPath, async function parse_to_preview(env) {
    let preview_data = await N.parser.md2preview({
      text: env.params.txt,
      limit: 250,
      link2text: true
    });

    env.data.preview = preview_data.preview;
  });


  // Limit an amount of images in the message
  //
  N.wire.after(apiPath, async function check_images_count(env) {
    let max_images = await env.extras.settings.fetch('users_message_max_images');

    if (max_images <= 0) return;

    let ast         = $.parse(env.data.parse_result.html);
    let images      = ast.find('.image').length;
    let attachments = ast.find('.attach').length;
    let tail        = env.data.parse_result.tail.length;

    if (images + attachments + tail > max_images) {
      throw {
        code: N.io.CLIENT_ERROR,
        message: env.t('err_too_many_images', max_images)
      };
    }
  });


  // Limit an amount of emoticons in the post
  //
  N.wire.after(apiPath, async function check_emoji_count(env) {
    let max_emojis = await env.extras.settings.fetch('users_message_max_emojis');

    if (max_emojis < 0) return;

    if ($.parse(env.data.parse_result.html).find('.emoji').length > max_emojis) {
      throw {
        code: N.io.CLIENT_ERROR,
        message: env.t('err_too_many_emojis', max_emojis)
      };
    }
  });


  // Create message
  //
  N.wire.after(apiPath, async function create_message(env) {
    let message_data = {
      ts:           Date.now(),
      user:         env.user_info.user_id,
      html:         env.data.parse_result.html,
      md:           env.params.txt,
      attach:       env.params.attach,
      params:       env.data.parse_options,
      imports:      env.data.parse_result.imports,
      import_users: env.data.parse_result.import_users,
      tail:         env.data.parse_result.tail
    };

    let dlg_update_data = {
      cache: {
        last_user: message_data.user,
        last_ts: message_data.ts,
        preview: env.data.preview
      }
    };


    // Create own message and update dialog
    //
    let own_msg = new N.models.users.DlgMessage(_.assign({
      parent: env.data.dialog._id
    }, message_data));

    await Promise.all([
      own_msg.save(),
      N.models.users.Dialog.update({ _id: own_msg.parent }, _.merge({
        unread: 0,
        cache: {
          last_message: own_msg._id,
          is_reply:     String(own_msg.user) === String(message_data.user)
        }
      }, dlg_update_data))
    ]);


    // Fetch related dialog
    //
    let dialogs = await N.models.users.Dialog.find()
                            .where('common_id').equals(env.data.dialog.common_id)
                            .lean(true);
    let related_dialog = _.find(dialogs, d => String(d.user) !== env.user_info.user_id);


    // Create opponent's message if:
    //
    // - related dialog exists (current user start this dialog when he was not hellbanned)
    // - both users are hellbanned
    // - both users are not hellbanned
    //
    if (related_dialog && ((env.user_info.hb && env.data.to.hb) || (!env.user_info.hb && !env.data.to.hb))) {
      let opponent_msg = new N.models.users.DlgMessage(_.assign({
        parent: related_dialog._id
      }, message_data));

      await Promise.all([
        opponent_msg.save(),
        N.models.users.Dialog.update({ _id: opponent_msg.parent }, _.merge({
          exists:       true, // force undelete
          $inc:         { unread: 1 }, // increment unread count
          cache:        {
            last_message: opponent_msg._id,
            is_reply:     String(opponent_msg.user) === String(message_data.user)
          }
        }, dlg_update_data))
      ]);

      let dialogs_notify = await N.settings.get('dialogs_notify', { user_id: related_dialog.user });

      if (dialogs_notify) {
        // Notify opponent
        await N.wire.emit('internal:users.notify', {
          src: related_dialog._id,
          to: related_dialog.user,
          type: 'USERS_MESSAGE'
        });
      }
    }


    // Fill response
    //
    env.res.dialog_id  = own_msg.parent;
    env.res.message_id = own_msg._id;
  });


  // Mark user as active
  //
  N.wire.after(apiPath, async function set_active_flag(env) {
    await N.wire.emit('internal:users.mark_user_active', env);
  });
};
