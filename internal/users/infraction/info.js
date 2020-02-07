// Fill urls and titles for dialogs (`DIALOG_MESSAGE`)
//
// In:
//
// - infractions ([users.Infraction])
// - user_info (Object)
//
// Out:
//
// - info (Object) - key is `src`, value { url, title, text }
//
'use strict';


const _ = require('lodash');


module.exports = function (N, apiPath) {

  N.wire.on(apiPath, async function dialogs_fetch_infraction_info(info_env) {
    let message_ids = _.map(info_env.infractions.filter(
      i => i.src_type === N.shared.content_type.DIALOG_MESSAGE
    ), 'src');

    if (!message_ids.length) return;


    // Fetch messages
    //
    let messages = await N.models.users.DlgMessage.find()
                             .where('_id').in(message_ids)
                             .lean(true);

    // Fetch dialogs
    //
    let dialogs = await N.models.users.Dialog.find()
                            .where('_id').in(_.map(messages, 'parent'))
                            .lean(true);

    let params = {
      user_id: info_env.user_info.user_id,
      usergroup_ids: info_env.user_info.usergroups
    };

    // users who can give out infractions could also see all dialogs
    if (!await N.settings.get('users_mod_can_add_infractions_dialogs', params, {})) {
      dialogs = dialogs.filter(dialog => String(dialog.user) === String(info_env.user_info.user_id));
    }

    // Fetch opponents
    //
    let opponents = await N.models.users.User.find()
                              .where('_id').in(_.map(dialogs, 'to'))
                              .lean(true);

    let dialogs_by_id = _.keyBy(dialogs, '_id');
    let users_by_id = _.keyBy(opponents, '_id');

    messages.forEach(message => {
      let dialog = dialogs_by_id[message.parent];
      if (!dialog) return;

      info_env.info[message._id] = {
        title: users_by_id[dialog.with] && users_by_id[dialog.with].name,
        url: N.router.linkTo('users.dialog', {
          dialog_id:  dialog._id,
          message_id: message._id
        }),
        text: message.md
      };
    });
  });
};
