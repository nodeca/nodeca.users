// Model for file page (comments, file usage...)
'use strict';

var Mongoose = require('mongoose');
var Schema = Mongoose.Schema;
var async = require('async');
var gm = require('gm');
var mimoza = require('mimoza');

module.exports = function (N, collectionName) {
  var Media = new Schema({
    'file_id'     : { 'type': Schema.Types.ObjectId, 'index': true },
    'user_id'     : Schema.Types.ObjectId,
    'album_id'    : { 'type': Schema.Types.ObjectId, 'index': true },
    'created_at'  : Date,
    'description' : String
  }, {
    versionKey: false
  });


  // Create previews
  //
  // src (Mixed) - (buffer|path|stream) with image file data. Required.
  //
  // Returns orig file
  //
  Media.statics.fileCreatePreviews = function (src, callback) {
    var sizeSettings = N.config.options.users.media_sizes;
    var sizes = [];

    Object.keys(sizeSettings).forEach(function (key) {
      // If size was overridden by null
      if (!sizeSettings[key]) {
        return;
      }

      var size = sizeSettings[key].split('x');
      sizes.push({ 'key': key, 'width': size[0], 'height': size[1] });
    });

    // 'orig' must be first because another use it's name
    sizes.sort(function (a, b) { return a.key === 'orig' ? -1 : b.key === 'orig' ? 1 : 0; });

    var origFile;

    async.eachSeries(sizes, function (size, callback) {
      // Get image size
      gm(src).size(function(err, imageSize) {
        if (err) { return callback(err); }

        // Get image format
        this.format(function (err, imageFormat) {
          if (err) { return callback(err); }
          var contentType = mimoza.getMimeType(imageFormat);

          // Resize if image bigger than preview size
          if (!(imageSize.width < size.width && imageSize.height < size.height)) {
            // Resize by height and crop extra
            this
              .resize(null, size.height)
              .gravity('Center')
              .crop(size.width, size.height);
          }

          // Save
          this.toBuffer(function (err, buffer) {
            if (err) { return callback(err); }

            var params = { 'contentType': contentType };
            if (origFile) {
              // Specify name for preview
              params.filename = origFile._id + '_' + size.key;
            }

            N.models.core.File.put(buffer, params, function (err, file) {
              if (err) { return callback(err); }

              if (size.key === 'orig') {
                origFile = file;
              }

              callback();
            });
          });
        });
      });
    }, function (err) {
      if (err) { return callback(err); }

      callback(null, origFile);
    });
  };


  N.wire.on('init:models', function emit_init_GlobalSettings(__, callback) {
    N.wire.emit('init:models.' + collectionName, Media, callback);
  });

  N.wire.on('init:models.' + collectionName, function init_model_GlobalSettings(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
