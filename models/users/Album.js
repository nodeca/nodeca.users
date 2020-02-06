// User albums

'use strict';


const Mongoose = require('mongoose');
const Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  var Album = new Schema({
    title:        String,
    user:         Schema.Types.ObjectId,
    last_ts:      { type: Date, default: Date.now },

    // Source file '_id'. Use thumbnail to show cover.
    cover_id:     Schema.Types.ObjectId,
    count:        { type: Number, default: 0 },
    description:  String,

    // true if almum is default, for incoming medias.
    // Such albums can not be deleted
    default:    { type: Boolean, default: false }
  }, {
    versionKey: false
  });

  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // User albums page, fetch albums list
  //
  // Sorting done in memory, because albums count per user is small, and we
  // always fetch full list.
  //
  // Note, album last ts & menia count are updated on each photo upload. It's
  // good to avoid index change.
  //
  Album.index({ user: 1 });


  //////////////////////////////////////////////////////////////////////////////


  // Update media count in album
  //
  async function updateCount(albumId, full) {
    let mTypes = N.models.users.MediaInfo.types;

    if (!full) {
      await N.models.users.Album.updateOne({ _id: albumId }, { $inc: { count: 1 } });
      return;
    }

    let result = await N.models.users.MediaInfo.countDocuments({ album: albumId, type: { $in: mTypes.LIST_VISIBLE } });

    await N.models.users.Album.updateOne({ _id: albumId }, { count: result });
  }


  // Update album cover
  //
  async function updateCover(albumId) {
    let mTypes = N.models.users.MediaInfo.types;
    let album = await N.models.users.Album.findOne({ _id: albumId }).lean(true);
    let fileId = album.cover_id || '000000000000000000000000';
    let cover = await N.models.users.MediaInfo
                          // album_id used to check if media moved to another album
                          .findOne({ media_id: fileId, type: mTypes.IMAGE, album: album._id })
                          .select('media_id')
                          .lean(true);

    // Do nothing if cover exists
    if (cover) return;

    let result = await N.models.users.MediaInfo
      .findOne({ album: album._id, type: mTypes.IMAGE })
      .sort('-ts')
      .lean(true);

    // Update cover with latest available image
    await N.models.users.Album.updateOne({ _id: albumId }, { cover_id: result ? result.media_id : null });
  }


  // Update album info (count, last_ts, cover)
  //
  // - albumId - album _id
  // - full - Boolean. true - recalculate count, false - just increment count. Default false
  //
  Album.statics.updateInfo = function (albumId, full) {
    return Promise.all([
      updateCount(albumId, full),
      updateCover(albumId),
      N.models.users.Album.updateOne({ _id: albumId }, { last_ts: Date.now() })
    ]);
  };


  N.wire.on('init:models', function emit_init_Album() {
    return N.wire.emit('init:models.' + collectionName, Album);
  });

  N.wire.on('init:models.' + collectionName, function init_model_Album(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
