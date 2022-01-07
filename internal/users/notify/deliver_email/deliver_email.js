// Deliver notification via email
//
'use strict';


const user_info = require('nodeca.users/lib/user_info');
const render    = require('nodeca.core/lib/system/render/common');


module.exports = function (N) {
  N.wire.after('internal:users.notify.deliver', async function notify_deliver_email(local_env) {

    // TODO: filter offline users


    // Fetch users emails
    //
    let users_email = await N.models.users.User.find()
                                .where('_id').in(Object.keys(local_env.messages))
                                .select('_id email')
                                .lean(true);

    let emails = users_email.reduce((acc, user) => {
      acc[user._id] = user.email;
      return acc;
    }, {});

    // Fetch user info
    //
    let users_info = await user_info(N, Object.keys(local_env.messages));

    // Remove users without email and send email to the rest
    //
    await Promise.all(Object.keys(local_env.messages).filter(user_id => emails[user_id]).map(user_id => {
      let params = {
        user_id,
        usergroup_ids: users_info[user_id].usergroups
      };

      return N.settings.get('can_receive_email', params, {})
        .then(can_receive_email => {
          // If user group can't receive emails - skip
          if (!can_receive_email) return null;

          let locale = users_info[user_id].locale || N.config.locales[0];
          let helpers = {};

          helpers.t = (phrase, params) => N.i18n.t(locale, phrase, params);
          helpers.t.exists = phrase => N.i18n.hasPhrase(locale, phrase);
          helpers.asset_body = path => N.assets.asset_body(path);

          let data = {
            to: emails[user_id],
            subject: local_env.messages[user_id].subject,
            html: render(N, 'users.notify.deliver_email', local_env.messages[user_id], helpers)
          };

          return N.mailer.send(data)
            .catch(err => {
              // don't return an error here
              N.logger.error('Cannot send email to %s: %s', emails[user_id], err.message || err);
            });
        });
    }));
  });
};
