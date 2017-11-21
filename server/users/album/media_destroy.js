// Delete media
//

'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    media_ids: { type: 'array', required: true, uniqueItems: true, items: { format: 'mongo' } },
    src_album: { format: 'mongo', required: true }
  });


  // Fetch source album
  //
  N.wire.before(apiPath, async function fetch_source_album(env) {
    let album = await N.models.users.Album.findById(env.params.src_album)
                          .lean(true);

    if (!album) {
      throw N.io.NOT_FOUND;
    }

    // Check album owner
    if (env.user_info.user_id !== String(album.user)) {
      throw N.io.FORBIDDEN;
    }

    env.data.src_album = album;
  });


  // Fetch media
  //
  N.wire.before(apiPath, async function fetch_media(env) {
    let mTypes = N.models.users.MediaInfo.types;
    let media = await N.models.users.MediaInfo.find()
                          .where('media_id').in(env.params.media_ids)
                          .where('type').in(mTypes.LIST_VISIBLE)
                          .where('album').equals(env.data.src_album._id)
                          .lean(true);

    // Check media owner
    for (let file of media) {
      if (env.user_info.user_id !== String(file.user)) {
        throw N.io.FORBIDDEN;
      }
    }

    env.data.media = media;
  });


  // Delete media
  //
  N.wire.on(apiPath, async function delete_media(env) {
    await Promise.all(
      env.data.media.map(media =>
        N.models.users.MediaInfo.markDeleted(media.media_id, false)
      )
    );

    await N.models.users.Album.updateInfo(env.data.src_album, true);
  });


  // Mark user as active
  //
  N.wire.after(apiPath, async function set_active_flag(env) {
    await N.wire.emit('internal:users.mark_user_active', env);
  });
};
