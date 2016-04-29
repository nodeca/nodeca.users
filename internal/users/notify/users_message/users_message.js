// Deliver `USERS_MESSAGE` notification
//
'use strict';


const render    = require('nodeca.core/lib/system/render/common');
const user_info = require('nodeca.users/lib/user_info');


module.exports = function (N) {
  N.wire.on('internal:users.notify.deliver', function* notify_deliver_users_message(local_env) {
    if (local_env.type !== 'USERS_MESSAGE') return;

    // Fetch dialog
    let dialog = yield N.models.users.Dialog.findOne()
                          .where('_id').equals(local_env.src)
                          .where('exists').equals(true)
                          .lean(true);

    if (!dialog) return;

    // User already read this dialog - don't need send notification
    if (!dialog.unread) return;

    // Fetch opponent
    let opponent = yield N.models.users.User.findOne()
                            .where('_id').equals(dialog.to)
                            .lean(true);

    // Fetch last message
    let message = yield N.models.users.DlgMessage.findOne()
                            .where('_id').equals(dialog.last_message)
                            .where('exists').equals(true)
                            .lean(true);

    if (!message) return;


    // Render notification
    //
    let general_project_name = yield N.settings.get('general_project_name');
    let to = yield user_info(N, dialog.user);

    let locale = to.locale || N.config.locales[0];
    let helpers = {};

    helpers.t = (phrase, params) => N.i18n.t(locale, phrase, params);
    helpers.t.exists = phrase => N.i18n.hasPhrase(locale, phrase);

    let subject = N.i18n.t(locale, 'users.notify.users_message.subject', {
      project_name: general_project_name,
      user_name:    opponent.name
    });

    let url = N.router.linkTo('users.dialog', {
      dialog_id:  dialog._id,
      message_id: message._id
    });

    let text = render(N, 'users.notify.users_message', { message_html: message.html, link: url }, helpers);

    local_env.messages[to.user_id] = { subject, text, url };
  });
};
