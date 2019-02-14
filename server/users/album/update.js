// Update album


'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    album_id:     { format: 'mongo', required: true },
    title:        { type: 'string',  required: true, minLength: 1 },
    description:  { type: 'string',  required: true },
    cover_id:     { format: 'mongo' }
  });


  // Fetch album info
  //
  N.wire.before(apiPath, async function fetch_album(env) {
    env.data.album = await N.models.users.Album
                              .findOne({ _id: env.params.album_id })
                              .lean(true);

    if (!env.data.album) throw N.io.NOT_FOUND;

    // No one can edit default album
    if (env.data.album.default)  throw N.io.NOT_FOUND;
  });


  // Fetch cover
  //
  N.wire.before(apiPath, async function fetch_cover(env) {
    var mTypes = N.models.users.MediaInfo.types;

    // Skip if cover_id isn't set
    if (!env.params.cover_id) return;

    let cover = await N.models.users.MediaInfo
                          .findOne({
                            media_id: env.params.cover_id,
                            type: mTypes.IMAGE,
                            album: env.data.album._id
                          })
                          .lean(true);

    // On invalid cover just leave existing intact.
    // That's more simple than process errors for very rare case.
    if (cover) env.data.cover = cover;
  });


  // Check permissions
  //
  N.wire.before(apiPath, function check_permissions(env) {
    var album = env.data.album;

    if (env.user_info.user_id !== String(album.user)) throw N.io.FORBIDDEN;
  });


  // Update album info
  //
  N.wire.on(apiPath, async function update_album(env) {
    var cover = env.data.cover;
    var album = env.data.album;

    var data = {
      title: env.params.title,
      description: env.params.description
    };

    if (cover) {
      data.cover_id = cover.media_id;
    }

    await N.models.users.Album.updateOne({ _id: album._id }, data);
  });
};
