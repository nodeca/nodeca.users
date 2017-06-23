// Hook for the "get permissions by url" feature, used in quote wrapper.
//

'use strict';


module.exports = function (N, apiPath) {

  N.wire.after(apiPath, async function check_user_access(access_env) {
    let match = N.router.matchAll(access_env.params.url).reduce(
      (acc, match) => (match.meta.methods.get === 'users.member' ? match : acc),
      null);

    if (!match) return;

    let user = await N.models.users.User.findOne()
                         .where('hid').equals(match.params.user_hid)
                         .where('exists').equals(true)
                         .lean(true);

    if (!user) return;

    access_env.data.access_read = true;
  });
};
