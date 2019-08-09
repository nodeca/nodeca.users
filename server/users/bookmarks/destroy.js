// Remove a bookmark
//

'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    bookmark_id: { format: 'mongo', required: true }
  });


  // Check auth
  //
  N.wire.before(apiPath, function check_auth(env) {
    if (!env.user_info.is_member) throw N.io.FORBIDDEN;
  });


  // Remove bookmark
  //
  N.wire.on(apiPath, async function bookmark_remove(env) {
    env.data.bookmark = await N.models.users.Bookmark.findOneAndRemove({
      _id:  env.params.bookmark_id,
      user: env.user_info.user_id // permission check
    });
  });
};
