// User albums

'use strict';


var Mongoose = require('mongoose');
var Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  var Album = new Schema({
    'title'         : String,
    'user_id'       : Schema.Types.ObjectId,
    'last_at'       : { 'type': Date, 'default': Date.now },

    // Source file '_id'. Use thumbnail to show cover.
    'cover_id'      : Schema.Types.ObjectId,
    'count'         : { 'type': Number, 'default': 0 },

    // true if almum is default, for incoming medias.
    // Such albums can not be deleted
    'default'       : { 'type': Boolean, 'default': false }
  },
  {
    versionKey: false
  });

  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // User albums page, fetch albums list
  // (sorting done in memory, because albums count is small)
  Album.index({ user_id   : 1 });


  //////////////////////////////////////////////////////////////////////////////


  // Update album fields
  // - 'last_at'
  // - 'cover_id'
  // - 'count'
  //
  Album.statics.updateInfo = function (albumId, callback) {
    var Media = N.models.users.Media;

    // Fetch album by id
    this.findOne({ '_id': albumId }).exec(function (err, album) {
      if (err) { return callback(err); }

      // Fetch count of media in album
      Media.count({ 'album_id': album._id }, function (err, cnt) {
        if (err) { return callback(err); }

        // Fetch newest media in album
        Media.findOne({ 'album_id': album._id }).sort('-created_at').lean(true).exec(function (err, result) {
          if (err) { return callback(err); }

          if (result) {
            // Set results
            album.cover_id = result.file_id;
            if (album.last_at < result.created_at) {
              album.last_at = result.created_at;
            }
          } else {
            // To show "No cover" for album, if it has no photo
            album.cover_id = null;
          }

          album.count = cnt;

          album.save(callback);
        });
      });
    });
  };

  N.wire.on('init:models', function emit_init_GlobalSettings(__, callback) {
    N.wire.emit('init:models.' + collectionName, Album, callback);
  });

  N.wire.on('init:models.' + collectionName, function init_model_GlobalSettings(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
