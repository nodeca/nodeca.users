// Show move media page
//

'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {});


  // Fetch albums list (_id and title) for album change dropdown
  //
  N.wire.on(apiPath, async function fetch_albums(env) {
    env.res.albums = await N.models.users.Album.find()
                              .where('user').equals(env.user_info.user_id)
                              .sort('-default -last_ts')
                              .select('_id title')
                              .lean(true);
  });
};
