// Model for file page (comments, file usage...)
'use strict';

var Mongoose = require('mongoose');
var Schema = Mongoose.Schema;
var async = require('async');
var gm = require('gm');
var mimoza = require('mimoza');
var fstools = require('fs-tools');
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


  // Reads image and prepare gm instance
  //
  // - path - path of image file. Required.
  // - size (Object) - size description from config. Required.
  //
  // callback(err, gm, contentType)
  //
  var resizeImage = function (path, size, callback) {
    // Get image size
    gm(path).size(function(err, imageSize) {
      if (err) { return callback(err); }

      // Get image format
      this.format(function (err, imageFormat) {
        if (err) { return callback(err); }
        var contentType = mimoza.getMimeType(imageFormat);

        // Resize if image bigger than preview size
        if (imageSize.width > size.width || imageSize.height > size.height) {
          // Resize by height and crop extra
          this
            .quality(size.quality)
            .resize(null, size.height)
            .gravity('Center')
            .crop(size.width, size.height);
        }

        callback(null, this, contentType);
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
    var origTmp = fstools.tmpdir();
    var origContentType, origId;

    async.series([

      // First - create orig tmp image (first size in mediaSizes)
      function (next) {
        resizeImage(path, mediaSizes[0], function (err, gm, contentType) {
          if (err) { return next(err); }

          origContentType = contentType;
          gm.write(origTmp, next);
        });
      },

      // Save orig file to gridfs to get
      function (next) {
        N.models.core.File.put(origTmp, { 'contentType': origContentType }, function (err, file) {
          if (err) { return next(err); }
          origId = file._id;
          next();
        });
      },

      // Create previews for all sizes exclude orig (first)
      function (next) {
        async.eachSeries(mediaSizes.slice(1), function (size, next) {
          // Resize
          resizeImage(origTmp, size, function (err, gm) {
            gm.toBuffer(function (err, buffer) {
              if (err) { return next(err); }

              // Save
              var params = { 'contentType': origContentType, 'filename': origId + '_' + size.size };
              N.models.core.File.put(buffer, params, function (err) {
                next(err);
              });
            });
          });
        }, next);
      }
    ], function (err) {
      fstools.removeSync(origTmp); // Remove tmp file

      if (err) {
        // Remove file with origId and all previews
        N.models.core.File.remove(origId, true, function () {
          callback(err);
        });
        return;
      }

      callback(null, origId);
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
