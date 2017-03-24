// Create new dialog
//
'use strict';


const _        = require('lodash');
const $        = require('nodeca.core/lib/parser/cheequery');
const ObjectId = require('mongoose').Types.ObjectId;


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    to:                       { type: 'string', required: true },
    title:                    { type: 'string', required: true },
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


  // Check user permission
  //
  N.wire.before(apiPath, function* check_permissions(env) {
    if (!env.user_info.is_member) return N.io.NOT_FOUND;

    let can_create_dialogs = yield env.extras.settings.fetch('can_create_dialogs');

    if (!can_create_dialogs) throw N.io.FORBIDDEN;
  });


  // Check title length
  //
  N.wire.before(apiPath, function check_title_length(env) {
    // Should never happens - restricted on client
    if (!env.params.title.trim()) throw N.io.BAD_REQUEST;
  });


  // Fetch `to` user by nick
  //
  N.wire.before(apiPath, function* fetch_receiver(env) {
    env.data.to = yield N.models.users.User.findOne()
                            .where('nick').equals(env.params.to)
                            .where('exists').equals(true)
                            .lean(true);

    if (!env.data.to) {
      throw {
        type: 'BAD_NICK',
        code: N.io.CLIENT_ERROR,
        message: env.t('err_user_not_found')
      };
    }

    if (String(env.data.to._id) === env.user_info.user_id) {
      throw {
        type: 'BAD_NICK',
        code: N.io.CLIENT_ERROR,
        message: env.t('err_write_to_self')
      };
    }
  });


  // Check if recipient is able to use dialogs
  //
  N.wire.before(apiPath, function* check_recipient_permissions(env) {
    let can_use_dialogs = yield N.settings.get('can_use_dialogs', {
      user_id: env.data.to._id,
      usergroup_ids: env.data.to.usergroups
    }, {});

    if (!can_use_dialogs) {
      throw {
        type: 'BAD_NICK',
        code: N.io.CLIENT_ERROR,
        message: env.t('err_recipient_cant_use_dialogs')
      };
    }
  });


  // Check if people are ignoring each other
  //
  N.wire.before(apiPath, function* check_ignore(env) {
    let ignore_data;

    // Check if recipient ignores us (except for moderators)
    //
    ignore_data = yield N.models.users.Ignore.findOne()
                            .where('from').equals(env.data.to._id)
                            .where('to').equals(env.user_info.user_id)
                            .lean(true);

    if (ignore_data) {
      let cannot_be_ignored = yield env.extras.settings.fetch('cannot_be_ignored');

      if (!cannot_be_ignored) {
        throw {
          code: N.io.CLIENT_ERROR,
          message: env.t('err_sender_is_ignored')
        };
      }
    }

    // Check we ignoring recipient to make sure he can reply
    //
    ignore_data = yield N.models.users.Ignore.findOne()
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
  N.wire.before(apiPath, function* prepare_options(env) {
    let settings = yield N.settings.getByCategory(
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
  N.wire.on(apiPath, function* parse_text(env) {
    env.data.parse_result = yield N.parser.md2html({
      text: env.params.txt,
      attachments: env.params.attach,
      options: env.data.parse_options,
      user_info: env.user_info
    });
  });


  // Parse user input to preview
  //
  N.wire.after(apiPath, function* parse_to_preview(env) {
    let preview_data = yield N.parser.md2preview({
      text: env.params.txt,
      limit: 250,
      link2text: true
    });

    env.data.preview = preview_data.preview;
  });


  // Limit an amount of images in the message
  //
  N.wire.after(apiPath, function* check_images_count(env) {
    let max_images = yield env.extras.settings.fetch('users_message_max_images');

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
  N.wire.after(apiPath, function* check_emoji_count(env) {
    let max_emojis = yield env.extras.settings.fetch('users_message_max_emojis');

    if (max_emojis < 0) return;

    if ($.parse(env.data.parse_result.html).find('.emoji').length > max_emojis) {
      throw {
        code: N.io.CLIENT_ERROR,
        message: env.t('err_too_many_emojis', max_emojis)
      };
    }
  });


  // Create dialog
  //
  N.wire.after(apiPath, function* create_dialog(env) {
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

    let dialog_data = {
      common_id: new ObjectId(),
      title: env.params.title,
      cache: {
        last_user: message_data.user,
        last_ts: message_data.ts,
        preview: env.data.preview
      }
    };

    let models_to_save = [];


    // Create own dialog and message
    //
    let own_dialog = new N.models.users.Dialog(_.merge({
      user: env.user_info.user_id,
      to:   env.data.to._id
    }, dialog_data));

    let own_msg = new N.models.users.DlgMessage(_.assign({
      parent: own_dialog._id
    }, message_data));

    own_dialog.cache.last_message = own_msg._id;
    own_dialog.cache.is_reply     = String(own_msg.user) === String(message_data.user);

    models_to_save = models_to_save.concat([ own_dialog, own_msg ]);


    // Create opponent's dialog and message if:
    //
    // - both users are hellbanned
    // - both users are not hellbanned
    //
    if ((env.user_info.hb && env.data.to.hb) || (!env.user_info.hb && !env.data.to.hb)) {
      let opponent_dialog = new N.models.users.Dialog(_.merge({
        user:   env.data.to._id,
        to:     env.user_info.user_id,
        unread: 1
      }, dialog_data));

      let opponent_msg = new N.models.users.DlgMessage(_.assign({
        parent: opponent_dialog._id
      }, message_data));

      opponent_dialog.cache.last_message = opponent_msg._id;
      opponent_dialog.cache.is_reply     = String(opponent_msg.user) === String(message_data.user);

      models_to_save = models_to_save.concat([ opponent_dialog, opponent_msg ]);

      let dialogs_notify = yield N.settings.get('dialogs_notify', { user_id: opponent_dialog.user });

      if (dialogs_notify) {
        // Notify opponent
        yield N.wire.emit('internal:users.notify', {
          src:  opponent_dialog._id,
          to:   opponent_dialog.user,
          type: 'USERS_MESSAGE'
        });
      }
    }


    // Save models
    //
    yield Promise.all(models_to_save.map(m => m.save()));


    // Fill response
    //
    env.res.dialog_id  = own_msg.parent;
    env.res.message_id = own_msg._id;
  });


  // Mark user as active
  //
  N.wire.after(apiPath, function* set_active_flag(env) {
    yield N.wire.emit('internal:users.mark_user_active', env);
  });
};
