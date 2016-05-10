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
  N.wire.before(apiPath, function* check_permissions(env) {
    if (env.user_info.is_guest) return N.io.NOT_FOUND;

    let can_send_messages = yield env.extras.settings.fetch('can_send_messages');

    if (!can_send_messages) throw N.io.FORBIDDEN;
  });


  // Fetch dialog
  //
  N.wire.before(apiPath, function* check_title_length(env) {
    env.data.dialog = yield N.models.users.Dialog.findOne()
                                .where('_id').equals(env.params.dialog_id)
                                .where('user').equals(env.user_info.user_id)
                                .lean(true);

    if (!env.data.dialog) throw N.io.NOT_FOUND;
  });


  // Fetch to user
  //
  N.wire.before(apiPath, function* fetch_receiver(env) {
    env.data.to = yield N.models.users.User.findOne()
                            .where('_id').equals(env.data.dialog.to)
                            .lean(true);
  });


  // Prepare parse options
  //
  N.wire.before(apiPath, function* prepare_options(env) {
    let settings = yield N.settings.getByCategory(
      'messages_markup',
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
    env.data.parse_result = yield N.parse({
      text: env.params.txt,
      attachments: env.params.attach,
      options: env.data.parse_options,
      user_info: env.user_info
    });
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


  // Create message
  //
  N.wire.after(apiPath, function* create_message(env) {
    let message_data = {
      ts:           Date.now(),
      user:         env.user_info.user_id,
      html:         env.data.parse_result.html,
      md:           env.params.txt,
      attach:       env.params.attach,
      params:       env.data.parse_options,
      imports:      env.data.parse_result.imports,
      import_users: env.data.parse_result.import_users,
      image_info:   env.data.parse_result.image_info,
      tail:         env.data.parse_result.tail
    };


    // Create own message and update dialog
    //
    let own_msg = new N.models.users.DlgMessage(_.assign({
      parent: env.data.dialog._id
    }, message_data));

    yield [
      own_msg.save(),
      N.models.users.Dialog.update({ _id: own_msg.parent }, { unread: 0, last_message: own_msg._id })
    ];


    // Fetch related dialog
    //
    let dialogs = yield N.models.users.Dialog.find()
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

      yield [
        opponent_msg.save(),
        N.models.users.Dialog.update({ _id: opponent_msg.parent }, {
          exists:       true, // force undelete
          $inc:         { unread: 1 }, // increment unread count
          last_message: opponent_msg._id
        })
      ];

      let dialogs_notify = yield N.settings.get('dialogs_notify', { user_id: related_dialog.user });

      if (dialogs_notify) {
        // Notify opponent
        yield N.wire.emit('internal:users.notify', {
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
};
