// Deliver notification via email
//
'use strict';


var async     = require('async');
var user_info = require('nodeca.users/lib/user_info');


module.exports = function (N) {
  N.wire.after('internal:users.notify.deliver', function notify_deliver_email(local_env, callback) {
    var emails, users_info;

    // TODO: filter offline users

    async.series([

      // Fetch users emails
      //
      function (next) {
        N.models.users.AuthLink.find()
            .where('user_id').in(Object.keys(local_env.messages))
            .where('type').equals('plain')
            .lean(true)
            .exec(function (err, res) {

          if (err) {
            next(err);
            return;
          }

          emails = res.reduce(function (acc, link) {
            acc[link.user_id] = link.email;

            return acc;
          }, {});

          next();
        });
      },

      // Fetch user info
      //
      function (next) {
        user_info(N, Object.keys(local_env.messages), function (err, res) {
          if (err) {
            next(err);
            return;
          }

          users_info = res;
          next();
        });
      },

      // Send via email
      //
      function (next) {
        async.each(Object.keys(local_env.messages), function (user_id, next) {

          // If user have no email - skip
          if (!emails[user_id]) {
            next();
            return;
          }

          var params = {
            user_id: user_id,
            usergroup_ids: users_info[user_id].usergroups
          };

          N.settings.get('can_receive_email', params, {}, function (err, can_receive_email) {
            if (err) {
              next(err);
              return;
            }

            // If user group can't receive emails - skip
            if (!can_receive_email) {
              next();
              return;
            }

            var data = {
              to: emails[user_id],
              subject: local_env.messages[user_id].subject,
              html: local_env.messages[user_id].text
            };

            N.mailer.send(data, function (err) {
              if (err) {
                // don't return an error here
                N.logger.error('Cannot send email to %s: %s', emails[user_id], err.message || err);
              }

              next();
            });
          });
        }, next);
      }

    ], callback);
  });
};
