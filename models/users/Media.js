// Model for file page (comments, file usage...)
'use strict';

var Mongoose = require('mongoose');
var Schema = Mongoose.Schema;
var async = require('async');
var gm = require('gm');
var mimoza = require('mimoza');
var configReader = require('./_lib/size_config_reader');

module.exports = function (N, collectionName) {
  var mediaSizes;

  var Media = new Schema({
    'file_id'     : { 'type': Schema.Types.ObjectId, 'index': true },
    'user_id'     : Schema.Types.ObjectId,
    'album_id'    : { 'type': Schema.Types.ObjectId, 'index': true },
    'created_at'  : Date,
    'description' : String
  }, {
    versionKey: false
  });


  // Save resized image
  //
  // - path - path of image file. Required.
  // - size (Object) - size description from config. Required.
  // - originalId (String) - '_id' of original file. Optional.
  //
  // callback(err, fileInfo)
  //
  var putResizedImage = function (path, size, originalId, callback) {
    // Get image size
    gm(path).size(function(err, imageSize) {
      if (err) { return callback(err); }

      // Get image format
      this.format(function (err, imageFormat) {
        if (err) { return callback(err); }
        var contentType = mimoza.getMimeType(imageFormat);

        // Resize if image bigger than preview size
        if (!(imageSize.width < size.width && imageSize.height < size.height)) {
          // Resize by height and crop extra
          this
            .quality(size.quality)
            .resize(null, size.height)
            .gravity('Center')
            .crop(size.width, size.height);
        }

        // Save
        this.toBuffer(function (err, buffer) {
          if (err) { return callback(err); }

          var params = { 'contentType': contentType };
          if (originalId) {
            // Specify name for preview
            params.filename = originalId + '_' + size.size;
          }

          N.models.core.File.put(buffer, params, function (err, file) {
            if (err) { return callback(err); }

            callback(null, file);
          });
        });
      });
    });
  };


  // Create original image with previews
  //
  // - path - path of image file. Required.
  //
  // callback(err, originalFileInfo)
  //
  Media.statics.createImage = function (path, callback) {
    // First - create original image (first item in mediaSizes)
    putResizedImage(path, mediaSizes[0], '', function (err, fileInfo) {
      if (err) { return callback(err); }

      async.eachSeries(mediaSizes.slice(1), function (size, next) {
        putResizedImage(path, size, fileInfo._id, next);
      }, function (err) {
        if (err) {
          N.models.core.File.remove(fileInfo._id, true, function () {
            callback(err);
          });
          return;
        }

        callback(null, fileInfo);
      });
    });
  };


  N.wire.on('init:models', function emit_init_GlobalSettings(__, callback) {
    mediaSizes = configReader(((N.config.options || {}).users || {}).media_sizes || {});
    if (mediaSizes instanceof Error) {
      callback(mediaSizes);
    }

    N.wire.emit('init:models.' + collectionName, Media, callback);
  });

  N.wire.on('init:models.' + collectionName, function init_model_GlobalSettings(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
