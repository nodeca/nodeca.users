// Logout authenticated user and remove sessions (in mongo and redis)
//

'use strict';


module.exports = async function archive_session(N, session_ids, logout_type = 0) {
  if (!Array.isArray(session_ids)) session_ids = [ session_ids ];

  for (let session_id of session_ids) {
    let auth_session = await N.models.users.AuthSession.findOne({ session_id }).lean(true);

    if (!auth_session) continue;

    auth_session.logout_type = logout_type;

    try {
      await new N.models.users.AuthSessionLog(auth_session).save();
    } catch (err) {
      // prevent mongo errors from causing logout to fail due to race condition
      if (err.code !== 11000) throw err;
    }

    await N.models.users.AuthSession.deleteOne({ _id: auth_session._id });

    // Repeat session deletion, because session might be restored in the time
    // between redis and mongo calls above (e.g. race condition with a parallel
    // request).
    //
    await N.redis.del('sess:' + session_id);
  }
};
