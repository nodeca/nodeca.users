// User albums

'use strict';


const Mongoose = require('mongoose');
const Schema   = Mongoose.Schema;
const co       = require('co');


module.exports = function (N, collectionName) {

  var Album = new Schema({
    title:        String,
    user_id:      Schema.Types.ObjectId,
    last_ts:      { type: Date, 'default': Date.now },

    // Source file '_id'. Use thumbnail to show cover.
    cover_id:     Schema.Types.ObjectId,
    count:        { type: Number, 'default': 0 },
    description:  String,

    // true if almum is default, for incoming medias.
    // Such albums can not be deleted
    'default':    { type: Boolean, 'default': false }
  },
  {
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
  Album.index({ user_id   : 1 });


  //////////////////////////////////////////////////////////////////////////////


  // Update media count in album
  //
  let updateCount = co.wrap(function* (albumId, full) {
    let mTypes = N.models.users.MediaInfo.types;

    if (!full) {
      yield N.models.users.Album.update({ _id: albumId }, { $inc: { count: 1 } });
      return;
    }

    let result = yield N.models.users.MediaInfo.count({ album_id: albumId, type: { $in: mTypes.LIST_VISIBLE } });

    yield N.models.users.Album.update({ _id: albumId }, { count: result });
  });


  // Update album cover
  //
  let updateCover = co.wrap(function* (albumId) {
    let mTypes = N.models.users.MediaInfo.types;
    let album = yield N.models.users.Album.findOne({ _id: albumId }).lean(true);
    let fileId = album.cover_id || '000000000000000000000000';
    let cover = yield N.models.users.MediaInfo
                          // album_id used to check if media moved to another album
                          .findOne({ media_id: fileId, type: mTypes.IMAGE, album_id: album._id })
                          .select('media_id')
                          .lean(true);

    // Do nothing if cover exists
    if (cover) return;

    let result = yield N.models.users.MediaInfo
      .findOne({ album_id: album._id, type: mTypes.IMAGE })
      .sort('-ts')
      .lean(true);

    // Update cover with latest available image
    yield N.models.users.Album.update({ _id: albumId }, { cover_id: result ? result.media_id : null });
  });


  // Update album info (count, last_ts, cover)
  //
  // - albumId - album _id
  // - full - Boolean. true - recalculate count, false - just increment count. Default false
  //
  Album.statics.updateInfo = function (albumId, full) {
    return Promise.all([
      updateCount(albumId, full),
      updateCover(albumId),
      N.models.users.Album.update({ _id: albumId }, { last_ts: Date.now() })
    ]);
  };


  N.wire.on('init:models', function emit_init_Album(__, callback) {
    N.wire.emit('init:models.' + collectionName, Album, callback);
  });

  N.wire.on('init:models.' + collectionName, function init_model_Album(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
