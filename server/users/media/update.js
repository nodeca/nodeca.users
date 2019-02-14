// Update media
//
'use strict';


module.exports = function (N, apiPath) {


  N.validate(apiPath, {
    media_id: { format: 'mongo', required: true },
    album_id: { format: 'mongo', required: true }
  });


  // Fetch media
  //
  N.wire.before(apiPath, async function fetch_media(env) {
    let mTypes = N.models.users.MediaInfo.types;
    let media = await N.models.users.MediaInfo
                          .findOne({ media_id: env.params.media_id, type: { $in: mTypes.LIST_VISIBLE } })
                          .lean(true);

    if (!media) {
      throw N.io.NOT_FOUND;
    }

    // Check media owner
    if (env.user_info.user_id !== String(media.user)) {
      throw N.io.FORBIDDEN;
    }

    env.data.media = media;
  });


  // Fetch album
  //
  N.wire.before(apiPath, async function fetch_album(env) {
    let album = await N.models.users.Album.findOne({ _id: env.params.album_id }).lean(true);

    if (!album) {
      throw N.io.NOT_FOUND;
    }

    // Check album owner
    if (env.user_info.user_id !== String(album.user)) {
      throw N.io.FORBIDDEN;
    }

    env.data.album = album;
  });


  // Update media
  //
  N.wire.on(apiPath, async function update_media(env) {
    let media = env.data.media;
    let album = env.data.album;

    if (album._id.toString() === media.album.toString()) {
      // Album not changed
      return;
    }

    await N.models.users.MediaInfo.updateOne({ _id: media._id }, { album: album._id });
  });


  // Update old and new album if changed
  //
  N.wire.after(apiPath, async function update_albums(env) {
    let media = env.data.media;
    let album = env.data.album;

    if (album._id.toString() === media.album.toString()) {
      // Album not changed
      return;
    }

    // Full update old album
    await N.models.users.Album.updateInfo(media.album, true);

    // Update new album (increment count)
    await N.models.users.Album.updateInfo(album._id);
  });


  // Mark user as active
  //
  N.wire.after(apiPath, async function set_active_flag(env) {
    await N.wire.emit('internal:users.mark_user_active', env);
  });
};
