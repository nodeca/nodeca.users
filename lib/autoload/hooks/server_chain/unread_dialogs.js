// Check if user has any unread dialogs
//

'use strict';


module.exports = function (N) {

  N.wire.after('server_chain:http:*', async function inject_unread_dialogs(env) {
    env.runtime.unread_dialogs = await N.models.users.DlgUnread.get(env.user_info.user_id);
  });
};
