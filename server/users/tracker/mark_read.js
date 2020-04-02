// Mark everything as read
//
'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});


  N.wire.on(apiPath, async function mark_read(env) {
    await N.models.users.Marker.markAll(env.user_info.user_id);
  });
};
