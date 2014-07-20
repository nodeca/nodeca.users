// User albums

'use strict';


var async = require('async');
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
  //
  // Sorting done in memory, because albums count per user is small, and we
  // always fetch full list.
  //
  // Note, album last ts & menia count are updated on each photo upload. It's
  // good to avoid index change.
  //
  Album.index({ user_id   : 1 });


  //////////////////////////////////////////////////////////////////////////////


  // Update album fields
  // - 'last_at'
  // - 'cover_id'
  // - 'custom_cover'
  // - 'count'
  //
  Album.statics.updateInfo = function (albumId, callback) {
    var Media = N.models.users.Media;
    var self = this;
    var album;
    var cnt;
    var media;
    var coverExists;

    async.series([

      // Fetch album by id
      function (next) {
        self.findOne({ '_id': albumId }).exec(function (err, result) {
          if (err) {
            next(err);
            return;
          }
          album = result;
          next();
        });
      },

      // Fetch count of media in album
      function (next) {
        Media.count({ 'album_id': album._id }, function (err, result) {
          if (err) {
            next(err);
            return;
          }
          cnt = result;
          next();
        });
      },

      // Fetch newest media in album
      function (next) {
        Media.findOne({ 'album_id': album._id }).sort('-created_at').lean(true).exec(function (err, result) {
          if (err) {
            next(err);
            return;
          }
          media = result;
          next();
        });
      },

      // Check cover file exists
      function (next) {
        Media.count({ 'file_id': album.cover_id }, function (err, result) {
          if (err) {
            next(err);
            return;
          }
          coverExists = result;
          next();
        });
      }
    ], function (err) {
      if (err) {
        callback(err);
        return;
      }

      if (media) {
        if (!album.cover_id || coverExists === 0) {
          if (media.type === 'image') {
            album.cover_id = media.file_id;
          }
        }

        if (album.last_at < media.created_at) {
          album.last_at = media.created_at;
        }
      } else {
        // To show "No cover" for album, if it has no photo
        album.cover_id = null;
      }

      album.count = cnt;

      album.save(callback);
    });
  };

  N.wire.on('init:models', function emit_init_Album(__, callback) {
    N.wire.emit('init:models.' + collectionName, Album, callback);
  });

  N.wire.on('init:models.' + collectionName, function init_model_Album(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
