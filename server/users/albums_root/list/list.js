// Fetch albums list
//
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid: { type: 'integer', minimum: 1, required: true }
  });


  // Fetch owner
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env) {
    return N.wire.emit('internal:users.fetch_user_by_hid', env);
  });


  // Forbid access to pages owned by bots
  //
  N.wire.before(apiPath, async function bot_member_pages_forbid_access(env) {
    let is_bot = await N.settings.get('is_bot', {
      user_id: env.data.user._id,
      usergroup_ids: env.data.user.usergroups
    }, {});

    if (is_bot) throw N.io.NOT_FOUND;
  });


  // Find and processes user albums
  //
  N.wire.on(apiPath, function* get_user_albums(env) {
    let query = N.models.users.Album.find()
                    .where('user').equals(env.data.user._id)
                    .sort('-default -last_ts')
                    .lean(true);

    if (env.user_info.user_hid !== env.data.user.hid) {
      // Hide empty albums for non-owner
      query.where('count').gt(0);
    }

    env.res.albums = yield query;

    // For check is user owner
    env.res.user_hid = env.data.user.hid;
  });
};
