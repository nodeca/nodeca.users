// User albums
'use strict';

var Mongoose = require('mongoose');
var Schema = Mongoose.Schema;

module.exports = function (N, collectionName) {
  var Album = new Schema({
    'title'         : String,
    'user_id'       : { 'type': Schema.Types.ObjectId, 'index': true },
    'last_at'       : { 'type': Date, 'required': true, 'default': Date.now },

    // Source file '_id'. Use thumbnail to show cover.
    'cover_id'      : { 'type': Schema.Types.ObjectId },
    'count'         : { 'type': Number, 'default': 0 },

    // It is unique album for each user. It contains unsorted photos. Nobody cannot delete this album.
    'default'       : { 'type': Boolean, 'required': true, 'default': false }
  },
  {
    versionKey: false
  });


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

          // Set results
          if (result) {
            album.cover_id = result.file_id;
            album.last_at = result.created_at;
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
