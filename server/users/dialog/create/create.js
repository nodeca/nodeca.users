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
    if (env.user_info.is_guest) return N.io.NOT_FOUND;

    let can_send_messages = yield env.extras.settings.fetch('can_send_messages');

    if (!can_send_messages) throw N.io.FORBIDDEN;
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
    let max_images = yield env.extras.settings.fetch('users_messages_text_max_images');

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
    let max_emojis = yield env.extras.settings.fetch('users_messages_text_max_emojis');

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
      user_id:      env.user_info.user_id,
      html:         env.data.parse_result.html,
      md:           env.params.txt,
      attach:       env.params.attach,
      params:       env.data.parse_options,
      imports:      env.data.parse_result.imports,
      import_users: env.data.parse_result.import_users,
      image_info:   env.data.parse_result.image_info,
      tail:         env.data.parse_result.tail
    };

    let dialog_data = {
      common_id: new ObjectId(),
      title:     env.params.title
    };

    let models_to_save = [];


    // Create own dialog and message
    //
    let own_dialog = new N.models.users.Dialog(_.assign({
      user_id: env.user_info.user_id,
      to:      env.data.to._id
    }, dialog_data));

    let own_msg = new N.models.users.DlgMessage(_.assign({
      dialog_id: own_dialog._id
    }, message_data));

    own_dialog.last_message = own_msg._id;

    models_to_save = models_to_save.concat([ own_dialog, own_msg ]);


    // Create opponent's dialog and message if:
    //
    // - both users are hellbanned
    // - both users are not hellbanned
    //
    if ((env.user_info.hb && env.data.to.hb) || (!env.user_info.hb && !env.data.to.hb)) {
      let opponent_dialog = new N.models.users.Dialog(_.assign({
        user_id: env.data.to._id,
        to:      env.user_info.user_id,
        unread:  1
      }, dialog_data));

      let opponent_msg = new N.models.users.DlgMessage(_.assign({
        dialog_id: opponent_dialog._id
      }, message_data));

      opponent_dialog.last_message = opponent_msg._id;

      models_to_save = models_to_save.concat([ opponent_dialog, opponent_msg ]);
    }


    // Save models
    //
    yield models_to_save.map(m => m.save());


    // Fill response
    //
    env.res.dialog_id  = own_msg.dialog_id;
    env.res.message_id = own_msg._id;
  });
};
