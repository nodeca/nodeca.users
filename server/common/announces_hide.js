// Mark an announce as dismissed


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, { announceid: String });

  N.wire.on(apiPath, async function hide_announce(env) {
    if (!env.user_info.is_member) return;
    if (!N.config.announces) return;

    let announce = N.config.announces[env.params.announceid];

    if (!announce) return;
    if (!announce.hide_days) return;

    await N.models.users.AnnounceHideMark.updateOne(
      { user: env.user_info.user_id },
      { $set: {
        [`hide.${env.params.announceid}`]: new Date(Date.now() + announce.hide_days * 86400000),
        ts: new Date()
      } },
      { upsert: true }
    );
  });
};
