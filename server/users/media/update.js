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
  N.wire.before(apiPath, function* fetch_media(env) {
    let mTypes = N.models.users.MediaInfo.types;
    let media = yield N.models.users.MediaInfo
                          .findOne({ media_id: env.params.media_id, type: { $in: mTypes.LIST_VISIBLE } })
                          .lean(true);

    if (!media) {
      throw N.io.NOT_FOUND;
    }

    // Check media owner
    if (env.user_info.user_id !== String(media.user_id)) {
      throw N.io.FORBIDDEN;
    }

    env.data.media = media;
  });


  // Fetch album
  //
  N.wire.before(apiPath, function* fetch_album(env) {
    let album = yield N.models.users.Album.findOne({ _id: env.params.album_id }).lean(true);

    if (!album) {
      throw N.io.NOT_FOUND;
    }

    // Check album owner
    if (env.user_info.user_id !== String(album.user_id)) {
      throw N.io.FORBIDDEN;
    }

    env.data.album = album;
  });


  // Update media
  //
  N.wire.on(apiPath, function* update_media(env) {
    let media = env.data.media;
    let album = env.data.album;

    if (album._id.toString() === media.album_id.toString()) {
      // Album not changed
      return;
    }

    yield N.models.users.MediaInfo.update({ _id: media._id }, { album_id: album._id });
  });


  // Update old and new album if changed
  //
  N.wire.after(apiPath, function* update_albums(env) {
    let media = env.data.media;
    let album = env.data.album;

    if (album._id.toString() === media.album_id.toString()) {
      // Album not changed
      return;
    }

    // Full update old album
    yield N.models.users.Album.updateInfo(media.album_id, true);

    // Update new album (increment count)
    yield N.models.users.Album.updateInfo(album._id);
  });
};
