// Delete album


'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    album_id: {
      format: 'mongo',
      required: true
    }
  });


  // Fetch album info
  //
  N.wire.before(apiPath, async function fetch_album(env) {
    let album = await N.models.users.Album
      .findOne({ _id: env.params.album_id })
      .lean(false); // Use as mongoose model

    if (!album) throw N.io.NOT_FOUND;

    // No one can edit default album
    if (album.default) throw N.io.NOT_FOUND;

    env.data.album = album;
  });


  // Check permissions
  //
  N.wire.before(apiPath, function check_permissions(env) {
    var album = env.data.album;

    if (env.user_info.user_id !== String(album.user)) {
      return N.io.FORBIDDEN;
    }
  });


  // Fetch album media
  //
  N.wire.before(apiPath, async function fetch_media(env) {
    env.data.album_media = await N.models.users.MediaInfo
      .find({ album: env.data.album._id })
      .lean(false); // Use as mongoose model
  });


  // Delete album with all photos
  //
  N.wire.on(apiPath, async function delete_album(env) {
    await Promise.all(
      env.data.album_media.map(media =>
        N.models.users.MediaInfo.markDeleted(media.media_id, false)
      )
    );

    await env.data.album.remove();

    let default_album = await N.models.users.Album.findOne()
                                  .where('user').equals(env.data.album.user)
                                  .where('default').equals(true)
                                  .lean(true);

    if (default_album) {
      // "move" all files to default album. It is done to make sure if someone
      // somehow is viewing deleted photo, it'd have an album to go along with.
      // We don't need to update counters here (all files should be deleted).
      await N.models.users.MediaInfo.updateMany(
        { album: env.data.album._id },
        { $set: { album: default_album._id } }
      );
    }
  });
};
