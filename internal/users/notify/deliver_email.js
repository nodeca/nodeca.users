// Deliver notification via email
//
'use strict';


var async = require('async');


module.exports = function (N) {
  N.wire.after('internal:users.notify.deliver', function notify_deliver_email(local_env, callback) {
    var emails;

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

      // Send via email
      //
      function (next) {
        async.each(Object.keys(local_env.messages), function (user_id, next) {
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
        }, next);
      }
    ], callback);
  });
};
