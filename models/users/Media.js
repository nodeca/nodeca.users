// Model for file page (comments, file usage...)

'use strict';


var async     = require('async');
var gm        = require('gm');
var mimoza    = require('mimoza');
var fstools   = require('fs-tools');
var fs        = require('fs');
var extname   = require('path').extname;
var exec      = require('child_process').exec;

var Mongoose  = require('mongoose');
var Schema    = Mongoose.Schema;

var configReader  = require('../../server/_lib/uploads_config_reader');

module.exports = function (N, collectionName) {

  var mediaConfig;
  // Need different options, depending on ImageMagick or GraphicsMagick used.
  var gmConfigOptions;


  var Media = new Schema({
    'file_id'        : Schema.Types.ObjectId,
    'user_id'        : Schema.Types.ObjectId,
    'album_id'       : Schema.Types.ObjectId,
    'created_at'     : { 'type': Date, 'default': Date.now },
    'type'           : { 'type': String, 'enum': [ 'image', 'medialink', 'file' ], 'default': 'file' },
    'medialink_html' : String,
    'description'    : String
  }, {
    versionKey: false
  });

  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // Media page, routing
  Media.index({ file_id: 1 });

  // Album page, fetch medias
  // !!! sorting done in memory, because medias count per album is small
  Media.index({ album_id: 1 });

  // "All medias" page, medias list, sorted by date
  Media.index({ user_id: 1, _id: -1 });

  //////////////////////////////////////////////////////////////////////////////


  // Remove files with previews
  //
  Media.pre('remove', function (callback) {
    if (this.type === 'medialink') {
      callback();
      return;
    }

    N.models.core.File.remove(this.file_id, true, callback);
  });


  // Create preview for image
  //
  // - path - Image file path.
  // - resizeConfig
  //   - width
  //   - height
  //   - max_width
  //   - max_height
  //   - jpeg_quality
  //   - gif_animation
  //   - skip_size
  // - imageType - gif, jpeg, png, etc
  //
  // - callback - function (err, { path, type })
  //
  var createPreview = function (path, resizeConfig, imageType, callback) {
    fs.stat(path, function (err, stats) {
      if (err) {
        callback(err);
        return;
      }

      var outType = resizeConfig.type || imageType;

      // To determine output image type, we must specify file extention
      var tmpFilePath = fstools.tmpdir() + '.' + outType;

      // If animation not allowed - take first frame of gif image
      path = (imageType === 'gif' && resizeConfig.gif_animation === false) ? path + '[0]' : path;
      var gmInstance = gm(path).options(gmConfigOptions);

      // Set quality only for jpeg image
      if (outType === 'jpeg') {
        gmInstance.quality(resizeConfig.jpeg_quality);
      }

      // Is image size smaller than 'skip_size' - skip resizing
      if (resizeConfig.skip_size && stats.size < resizeConfig.skip_size) {

        // Save file and return result
        gmInstance.write(tmpFilePath, function (err) {
          if (err) {
            // Remove temporary file if error
            fs.unlink(tmpFilePath, function () {
              callback(err);
            });
            return;
          }

          callback(null, { path: tmpFilePath, type: outType });
        });
        return;
      }

      gmInstance.gravity('Center').size(function(err, imgSz) {
        if (err) {
          fs.unlink(tmpFilePath, function () {
            callback(err);
          });
          return;
        }

        // To scale image we calculate new width and height, resize image by height and crop by width
        var scaledHeight, scaledWidth;

        if (resizeConfig.height && !resizeConfig.width) {
          // If only height defined - scale to fit height,
          // and crop by max_width
          scaledHeight = resizeConfig.height;
          var proportionalWidth = Math.floor(imgSz.width * scaledHeight / imgSz.height);
          scaledWidth = (!resizeConfig.max_width || resizeConfig.max_width > proportionalWidth) ?
                        proportionalWidth :
                        resizeConfig.max_width;

        } else if (!resizeConfig.height && resizeConfig.width) {
          // If only width defined - scale to fit width,
          // and crop by max_height
          scaledWidth = resizeConfig.width;
          var proportionalHeight = Math.floor(imgSz.height * scaledWidth / imgSz.width);
          scaledHeight = (!resizeConfig.max_height || resizeConfig.max_height > proportionalHeight) ?
                         proportionalHeight :
                         resizeConfig.max_height;

        } else {
          // If determine both width and height
          scaledWidth = resizeConfig.width;
          scaledHeight = resizeConfig.height;
        }

        // Don't resize (only crop) image if height smaller than scaledHeight
        if (imgSz.height > scaledHeight) {
          gmInstance.resize(null, scaledHeight);
        }

        // Save file
        gmInstance.crop(scaledWidth, scaledHeight).write(tmpFilePath, function (err) {
          if (err) {
            // Remove temporary file if error
            fs.unlink(tmpFilePath, function () {
              callback(err);
            });
            return;
          }
          callback(null, { path: tmpFilePath, type: outType });
        });
      });
    });
  };


  // Save previews to database
  //
  // - previews - { orig: { path, type }, ... }
  // - maxSize - maximum size to save to database
  //
  // - callback - function (err, originalFileId)
  //
  var savePreviews = function (previews, maxSize, callback) {
    async.each(Object.keys(previews), function (key, next) {

      // Check file size
      fs.stat(previews[key].path, function (err, stats) {
        if (err) {
          next(err);
          return;
        }

        if (stats.size > maxSize) {
          next(new Error('Can\'t resize image: max size exceeded'));
          return;
        }

        next();
      });
    }, function (err) {
      if (err) {
        callback(err);
        return;
      }

      // Create new ObjectId for orig file
      var origId = new Mongoose.Types.ObjectId();
      async.each(
        Object.keys(previews),
        function (key, next) {
          var data = previews[key];

          var params = { 'contentType': mimoza.getMimeType(data.type) };
          if (key === 'orig') {
            params._id = origId;
          } else {
            params.filename = origId + '_' + key;
          }

          N.models.core.File.put(data.path, params, function (err) {
            next(err);
          });
        },
        function (err) {
          if (err) {
            callback(err);
            return;
          }

          callback(null, origId);
        }
      );
    });
  };

  // Create original image with previews
  //
  // - path - path of file with extention. Required.
  // - ext - file format (extension). Optional.
  //         If not set, get from path.
  //
  // - callback(err, originalFileId)
  //
  Media.statics.createImage = function (path, ext, callback) {
    if (!callback) {
      callback = ext;
      ext = null;
    }

    var format = ext || extname(path).replace('.', '').toLowerCase();

    // Is config for this type exists
    if (!mediaConfig.types[format]) {
      callback(new Error('Can\'t resize image: \'' + format + '\' images not supported'));
      return;
    }

    //var supportedImageFormats = [ 'bmp', 'gif', 'jpg', 'jpeg', 'png', 'ept', 'fax', 'ppm', 'pgm', 'pbm', 'pnm' ];
    //if (supportedImageFormats.indexOf(format) === -1) {
      // TODO: just check size and save file - without resize
    //}

    var typeConfig = mediaConfig.types[format];
    var previews = {};
    async.eachSeries(Object.keys(typeConfig.resize), function (resizeConfigKey, next) {
      // Create preview for each size

      var resizeConfig = typeConfig.resize[resizeConfigKey];
      // Next preview will be based on preview in 'from' property
      // by default next preview generated from 'orig'
      var from = (previews[resizeConfig.from || ''] || previews.orig || {});
      var filePath = from.path || path;
      createPreview(filePath, resizeConfig, from.type || format, function (err, data) {
        if (err) {
          next(err);
          return;
        }

        previews[resizeConfigKey] = data;
        next();
      });
    }, function (err) {
      // Delete all tmp files
      var deleteTmpPreviews = function (callback) {
        async.each(
          Object.keys(previews),
          function (key, next) {
            fs.unlink(previews[key].path, function () { next(); });
          },
          function () {
            callback();
          }
        );
      };

      if (err) {
        deleteTmpPreviews(function () {
          callback(err);
        });
        return;
      }

      // Save all previews
      savePreviews(previews, typeConfig.max_size, function (err, origId) {
        deleteTmpPreviews(function () {
          if (err) {
            callback(err);
            return;
          }
          callback(null, origId);
        });
      });
    });
  };


  N.wire.on('init:models', function emit_init_Media(__, callback) {
    // Read config
    try {
      mediaConfig = configReader(((N.config.options || {}).users || {}).media || {});
    } catch (e) {
      callback(e);
      return;
    }

    // Check is ImageMagick or GraphicsMagick installed
    // GraphicsMagick prefered
    exec('gm version', function (__, stdout) {
      // Don't check error because condition below is most strict
      if (stdout.indexOf('GraphicsMagick') !== -1) {
        // GraphicsMagick installed continue loading
        gmConfigOptions = {};
        N.wire.emit('init:models.' + collectionName, Media, callback);
        return;
      }

      // Check ImageMagick if GraphicsMagick not found
      exec('convert -version', function (__, stdout) {
        // Don't check error because condition below is most strict
        if (stdout.indexOf('ImageMagick') !== -1) {
          // ImageMagick installed continue loading
          gmConfigOptions = { 'imageMagick': true };
          N.wire.emit('init:models.' + collectionName, Media, callback);
          return;
        }

        callback(new Error('You need GraphicsMagick or ImageMagick to run this application. Can\'t find any.'));
      });
    });
  });


  N.wire.on('init:models.' + collectionName, function init_model_Media(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
