// Reply in dialog
//
'use strict';


const $        = require('nodeca.core/lib/parser/cheequery');
const ObjectId = require('mongoose').Types.ObjectId;


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    dialog_id:                { format: 'mongo', required: true },
    txt:                      { type: 'string', required: true },
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
                                .where('user').equals(env.user_info.user_id);

    if (!env.data.dialog) throw N.io.NOT_FOUND;
  });


  // Fetch to user
  //
  N.wire.before(apiPath, async function fetch_receiver(env) {
    env.data.to = await N.models.users.User.findOne()
                            .where('_id').equals(env.data.dialog.with)
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
      options: env.data.parse_options,
      user_info: env.user_info
    });
  });


  // Limit an amount of images in the message
  //
  N.wire.after(apiPath, async function check_images_count(env) {
    let max_images = await env.extras.settings.fetch('users_message_max_images');

    if (max_images <= 0) return;

    let ast         = $.parse(env.data.parse_result.html);
    let images      = ast.find('.image').length;
    let attachments = ast.find('.attach').length;

    if (images + attachments > max_images) {
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
      common_id:    new ObjectId(),
      ts:           Date.now(),
      html:         env.data.parse_result.html,
      md:           env.params.txt,
      ip:           env.req.ip,
      params:       env.data.parse_options,
      imports:      env.data.parse_result.imports,
      import_users: env.data.parse_result.import_users
    };

    let saved_msg;


    // Create own message and update dialog
    //
    // check current user to avoid creating 2 identical messages
    if (String(env.data.to._id) !== String(env.user_info.user_id)) {

      // Update own dialog
      //
      let own_dialog = env.data.dialog;

      let own_msg = new N.models.users.DlgMessage(Object.assign({
        parent: own_dialog._id,
        user: env.user_info.user_id,
        with: env.data.to._id,
        incoming: false
      }, message_data));

      // params should be passed separately and will be converted by hooks to params_ref
      own_msg.params = message_data.params;

      own_dialog.unread = false;
      // cache will be generated in updateSummary later, this is only here to stop race conditions
      own_dialog.cache.last_message = own_msg._id;

      await own_msg.save();
      await own_dialog.save();
      await N.models.users.Dialog.updateSummary(own_dialog._id);

      saved_msg = own_msg;
    }


    // Create opponent's message if:
    //
    // - both users are hellbanned
    // - both users are not hellbanned
    //
    if ((env.user_info.hb && env.data.to.hb) || (!env.user_info.hb && !env.data.to.hb)) {
      // Find opponent's dialog, create if doesn't exist
      //
      let opponent_dialog = await N.models.users.Dialog.findOne({
        user: env.data.to._id,
        with: env.user_info.user_id
      });

      if (!opponent_dialog) {
        opponent_dialog = new N.models.users.Dialog({
          user: env.data.to._id,
          with: env.user_info.user_id
        });
      }

      let opponent_msg = new N.models.users.DlgMessage(Object.assign({
        parent: opponent_dialog._id,
        user: env.data.to._id,
        with: env.user_info.user_id,
        incoming: true
      }, message_data));

      // params should be passed separately and will be converted by hooks to params_ref
      opponent_msg.params = message_data.params;

      opponent_dialog.unread = true;
      // cache will be generated in updateSummary later, this is only here to stop race conditions
      opponent_dialog.cache.last_message = opponent_msg._id;

      await opponent_msg.save();
      await opponent_dialog.save();
      await N.models.users.Dialog.updateSummary(opponent_dialog._id);

      let dialogs_notify = await N.settings.get('dialogs_notify', { user_id: opponent_dialog.user });

      if (dialogs_notify) {
        // Notify opponent
        await N.wire.emit('internal:users.notify', {
          src:  opponent_dialog._id,
          to:   opponent_dialog.user,
          type: 'USERS_MESSAGE'
        });
      }

      // user sends message to himself
      if (!saved_msg) saved_msg = opponent_msg;
    }


    // Fill response
    //
    env.res.dialog_id  = saved_msg.parent;
    env.res.message_id = saved_msg._id;
  });


  // Mark user as active
  //
  N.wire.after(apiPath, async function set_active_flag(env) {
    await N.wire.emit('internal:users.mark_user_active', env);
  });
};
