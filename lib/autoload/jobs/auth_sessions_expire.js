// Invalidate expired auth sessions
//

'use strict';


const _               = require('lodash');
const archive_session = require('nodeca.users/lib/archive_session');


module.exports = function (N) {
  N.wire.on('init:jobs', function register_auth_sessions_expire() {
    const task_name = 'auth_sessions_expire';

    if (!N.config.cron || !N.config.cron[task_name]) {
      return new Error(`No config defined for cron task "${task_name}"`);
    }

    N.queue.registerTask({
      name: task_name,
      pool: 'hard',
      cron: N.config.cron[task_name],
      async process() {

        try {
          let expireDays = await N.settings.get('general_login_expire_days');

          if (!expireDays) return;

          let sessions = await N.models.users.AuthSession.find()
                                   .where('first_ts').lte(Date.now() - expireDays.valueOf() * 24 * 60 * 60 * 1000)
                                   .lean(true);

          if (!sessions.length) return;

          await archive_session(N, _.map(sessions, 'session_id'), N.models.users.AuthSessionLog.logout_types.EXPIRED);

        } catch (err) {
          // don't propagate errors because we don't need automatic reloading
          N.logger.error('"%s" job error: %s', task_name, err.message || err);
        }
      }
    });
  });
};
