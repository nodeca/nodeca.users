// Deliver notification via email
//
'use strict';


const user_info = require('nodeca.users/lib/user_info');
const render    = require('nodeca.core/lib/system/render/common');


module.exports = function (N) {
  N.wire.after('internal:users.notify.deliver', function* notify_deliver_email(local_env) {

    // TODO: filter offline users


    // Fetch users emails
    //
    let res = yield N.models.users.AuthLink
                        .find()
                        .where('user_id').in(Object.keys(local_env.messages))
                        .where('type').equals('plain')
                        .lean(true);

    let emails = res.reduce((acc, link) => {
      acc[link.user_id] = link.email;
      return acc;
    }, {});

    // Fetch user info
    //
    let users_info = yield user_info(N, Object.keys(local_env.messages));

    // Send via email
    //
    yield Object.keys(local_env.messages).map(user_id => {
      // If user have no email - skip
      if (!emails[user_id]) return Promise.resolve();

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

          let data = {
            to: emails[user_id],
            subject: local_env.messages[user_id].subject,
            html: render(N, 'users.notify.deliver.email', local_env.messages[user_id], helpers)
          };

          return N.mailer.send(data)
            .catch(err => {
              // don't return an error here
              N.logger.error('Cannot send email to %s: %s', emails[user_id], err.message || err);
            });
        });
    });
  });
};
