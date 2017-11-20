// Move media between albums
//

'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    media_ids:  { type: 'array', required: true, uniqueItems: true, items: { format: 'mongo' } },
    from_album: { format: 'mongo', required: true },
    to_album:   { format: 'mongo', required: true }
  });


  // Fetch media
  //
  N.wire.before(apiPath, async function fetch_media(env) {
    let mTypes = N.models.users.MediaInfo.types;
    let media = await N.models.users.MediaInfo.find()
                          .where('media_id').in(env.params.media_ids)
                          .where('type').in(mTypes.LIST_VISIBLE)
                          .where('album').equals(env.params.from_album)
                          .lean(true);

    // Check media owner
    for (let file of media) {
      if (env.user_info.user_id !== String(file.user)) {
        throw N.io.FORBIDDEN;
      }
    }

    env.data.media = media;
  });


  // Fetch source album
  //
  N.wire.before(apiPath, async function fetch_source_album(env) {
    let album = await N.models.users.Album.findById(env.params.from_album)
                          .lean(true);

    if (!album) {
      throw N.io.NOT_FOUND;
    }

    // Check album owner
    if (env.user_info.user_id !== String(album.user)) {
      throw N.io.FORBIDDEN;
    }

    env.data.from_album = album;
  });


  // Fetch destination album
  //
  N.wire.before(apiPath, async function fetch_destination_album(env) {
    let album = await N.models.users.Album.findById(env.params.to_album)
                          .lean(true);

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
    if (env.data.from_album._id.toString() === env.data.album._id.toString()) {
      // Album not changed
      return;
    }

    let bulk = N.models.users.MediaInfo.collection.initializeUnorderedBulkOp();

    for (let file of env.data.media) {
      bulk.find({ _id: file._id })
          .updateOne({ $set: { album: env.data.album._id } });
    }

    if (bulk.length) await bulk.execute();
  });


  // Update old and new album if changed
  //
  N.wire.after(apiPath, async function update_albums(env) {
    if (env.data.from_album._id.toString() === env.data.album._id.toString()) {
      // Album not changed
      return;
    }

    // Update albums
    await N.models.users.Album.updateInfo(env.data.from_album, true);
    await N.models.users.Album.updateInfo(env.data.album, true);
  });


  // Mark user as active
  //
  N.wire.after(apiPath, async function set_active_flag(env) {
    await N.wire.emit('internal:users.mark_user_active', env);
  });
};
