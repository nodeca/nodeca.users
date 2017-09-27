// Submit form handler
//

'use strict';

const _          = require('lodash');
const validator  = require('is-my-json-valid');

const parse_options = {
  hr:   true,
  link: true
};


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    infraction_id: { format: 'mongo', required: true },
    message:       { type: 'string',  required: true }
  });


  // Create sandbox for form errors
  //
  N.wire.before(apiPath, function prepare_env_data(env) {
    env.data.errors = env.data.errors || {};
  });


  // Form input validator
  //
  const validate = validator({
    type: 'object',
    properties: {
      message: { type: 'string',  required: true, minLength: 1 }
    }
  }, {
    verbose: true
  });


  // Validate form data
  //
  N.wire.before(apiPath, function validate_params(env) {
    if (!validate(env.params)) {
      _.forEach(validate.errors, function (error) {
        // Don't customize form text, just highlight the field.
        env.data.errors[error.field.replace(/^data[.]/, '')] = true;
      });
    }
  });


  // If any of the previous checks failed, terminate with client error
  //
  N.wire.before(apiPath, function check_errors(env) {
    if (!_.isEmpty(env.data.errors)) {
      throw { code: N.io.CLIENT_ERROR, data: env.data.errors };
    }
  });


  // Check permission to start dialogs
  //
  N.wire.before(apiPath, async function check_permissions(env) {
    let can_create_dialogs = await env.extras.settings.fetch('can_create_dialogs');

    if (!can_create_dialogs) throw N.io.FORBIDDEN;
  });


  // Fetch infraction and check permissions
  //
  N.wire.before(apiPath, async function fetch_infraction(env) {
    let infraction = await N.models.users.Infraction.findOne()
                              .where('_id').equals(env.params.infraction_id)
                              .where('exists').equals(true)
                              .lean(true);

    if (!infraction) throw N.io.NOT_FOUND;

    // Allow to ask questions only about infractions issued to current user
    //
    if (String(infraction.for) !== String(env.user_info.user_id)) throw N.io.NOT_FOUND;

    // Allow to ask questions only about infractions issued to user within
    // a time limit of half a year
    //
    let hide = Date.now() - 6 * 30 * 24 * 60 * 60 * 1000;

    if (infraction.expire && infraction.expire <= hide) throw N.io.NOT_FOUND;

    env.data.infraction = infraction;
  });


  // Fetch moderator
  //
  N.wire.before(apiPath, async function fetch_receiver(env) {
    env.data.to = await N.models.users.User.findOne()
                            .where('_id').equals(env.data.infraction.from)
                            .where('exists').equals(true)
                            .lean(true);

    if (!env.data.to) {
      throw {
        code: N.io.CLIENT_ERROR,
        message: env.t('err_user_not_found')
      };
    }
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


  // Prepare dialog text
  //
  N.wire.before(apiPath, function prepare_text(env) {
    let reason;

    if (env.t.exists('@users.infractions.types.' + env.data.infraction.type)) {
      reason = env.t('@users.infractions.types.' + env.data.infraction.type);
    } else {
      reason = env.data.infraction.reason;
    }

    // escape markdown characters (user is only allowed to post plain text),
    // punctuation character set is the same as in markdown-it `text` rule
    let message = env.params.message.replace(/([!#$%&*+\-:<=>@[\\\]^_`{}~])/g, '\\$1');

    env.data.text = env.t('message_text', {
      reason,
      link:    N.router.linkTo('users.member', { user_hid: env.user_info.user_hid }) +
               '#infraction' + env.data.infraction._id,
      message
    });
  });


  // Parse user input to HTML
  //
  N.wire.on(apiPath, async function parse_text(env) {
    env.data.parse_result = await N.parser.md2html({
      text:        env.data.text,
      options:     parse_options,
      attachments: [],
      user_info:   env.user_info
    });
  });


  // Parse user input to preview
  //
  N.wire.after(apiPath, async function parse_to_preview(env) {
    let preview_data = await N.parser.md2preview({
      text: env.data.text,
      limit: 250,
      link2text: true
    });

    env.data.preview = preview_data.preview;
  });


  // Create message
  //
  N.wire.after(apiPath, async function create_message(env) {
    let message_data = {
      ts:           Date.now(),
      user:         env.user_info.user_id,
      html:         env.data.parse_result.html,
      md:           env.data.text,
      params:       parse_options,
      imports:      env.data.parse_result.imports,
      import_users: env.data.parse_result.import_users,
      tail:         env.data.parse_result.tail
    };

    let dlg_update_data = {
      exists: true, // force dialog to re-appear if it was deleted
      cache: {
        last_user: message_data.user,
        last_ts: message_data.ts,
        preview: env.data.preview
      }
    };

    let models_to_save = [];


    // Find own dialog, create if doesn't exist
    //
    let own_dialog = await N.models.users.Dialog.findOne({
      user: env.user_info.user_id,
      to:   env.data.to._id
    });

    if (!own_dialog) {
      own_dialog = new N.models.users.Dialog({
        user: env.user_info.user_id,
        to:   env.data.to._id
      });
    }

    _.merge(own_dialog, dlg_update_data);

    // Create own message and update dialog
    //
    // check current user to avoid creating 2 identical dialogs
    if (String(env.data.infraction.from) !== String(env.user_info.user_id)) {
      let own_msg = new N.models.users.DlgMessage(_.assign({
        parent: own_dialog._id
      }, message_data));

      own_dialog.cache.last_message = own_msg._id;
      own_dialog.cache.is_reply     = String(own_msg.user) === String(message_data.user);

      models_to_save = models_to_save.concat([ own_dialog, own_msg ]);
    }


    // Create opponent's dialog and message if:
    //
    // - both users are hellbanned
    // - both users are not hellbanned
    //
    if ((env.user_info.hb && env.data.to.hb) || (!env.user_info.hb && !env.data.to.hb)) {

      // Find opponent's dialog, create if doesn't exist
      //
      let opponent_dialog = await N.models.users.Dialog.findOne({
        user: env.data.to._id,
        to:   env.user_info.user_id
      });

      if (!opponent_dialog) {
        opponent_dialog = new N.models.users.Dialog({
          user: env.data.to._id,
          to:   env.user_info.user_id
        });
      }

      _.merge(opponent_dialog, dlg_update_data);

      let opponent_msg = new N.models.users.DlgMessage(_.assign({
        parent: opponent_dialog._id
      }, message_data));

      opponent_dialog.unread = (opponent_dialog.unread || 0) + 1;
      opponent_dialog.cache.last_message = opponent_msg._id;
      opponent_dialog.cache.is_reply     = String(opponent_msg.user) === String(message_data.user);

      models_to_save = models_to_save.concat([ opponent_dialog, opponent_msg ]);

      let dialogs_notify = await N.settings.get('dialogs_notify', { user_id: opponent_dialog.user });

      if (dialogs_notify) {
        // Notify opponent
        await N.wire.emit('internal:users.notify', {
          src:  opponent_dialog._id,
          to:   opponent_dialog.user,
          type: 'USERS_MESSAGE'
        });
      }
    }


    // Save models
    //
    await Promise.all(models_to_save.map(m => m.save()));
  });


  // Mark user as active
  //
  N.wire.after(apiPath, function set_active_flag(env) {
    return N.wire.emit('internal:users.mark_user_active', env);
  });
};
