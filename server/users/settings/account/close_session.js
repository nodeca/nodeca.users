// Close AuthSession by id
//

'use strict';


const archive_session = require('nodeca.users/lib/archive_session');


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    id: { format: 'mongo', required: true }
  });


  // Check auth
  //
  N.wire.before(apiPath, function check_auth(env) {
    if (!env.user_info.is_member) throw N.io.FORBIDDEN;
  });


  // Close session
  //
  N.wire.on(apiPath, async function close_session(env) {
    let session = await N.models.users.AuthSession.findOne()
                            .where('_id').equals(env.params.id)
                            .where('user').equals(env.user_info.user_id)
                            .lean(true);

    if (!session) return;

    await archive_session(N, session.session_id, N.models.users.AuthSessionLog.logout_types.REVOKED);
  });
};
