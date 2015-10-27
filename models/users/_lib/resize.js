// Create asset of resized images in file store
//
// - src - buffer|path|stream
//
// - options
//   - store - storage interface
//   - ext - file extension
//   - maxSize - maximum file size if resized images
//   - resize
//     - orig
//       - width
//       - height
//       - max_width
//       - max_height
//       - jpeg_quality
//       - skip_size
//     - sm
//       - ...
//
// - callback(
//     err,
//     {
//       id: ObjectId,
//       size: Number,
//       images: { orig: { width: Number , height: Number } }
//     }
//   )
//
'use strict';

var async    = require('async');
var gm       = require('gm');
var fstools  = require('fs-tools');
var Mongoose = require('mongoose');
var mimoza   = require('mimoza');
var _        = require('lodash');
var fs       = require('fs');

var File;


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
function createPreview(path, resizeConfig, imageType, callback) {
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
    var gmInstance = gm(path);

    // Set quality only for jpeg image
    if (outType === 'jpeg') {
      gmInstance.quality(resizeConfig.jpeg_quality).autoOrient();
    }

    if (resizeConfig.unsharp) {
      gmInstance.unsharp('0');
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

    gmInstance.gravity('Center').size(function (err, imgSz) {
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

      // TODO: save original image instead if no crop is required,
      //       but still need to do something about exif

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
}


// Save files to database
//
// - previews - { orig: { path, type }, ... }
// - maxSize - maximum size to save to database
// - resizeConfig
//
// - callback - function (err, originalFileId)
//
function saveFiles(previews, maxSize, callback) {
  async.each(Object.keys(previews), function (key, next) {

    // Check file size
    fs.stat(previews[key].path, function (err, stats) {
      if (err) {
        next(err);
        return;
      }

      previews[key].fileSize = stats.size;

      if (maxSize && stats.size > maxSize) {
        next(new Error('Can\'t save file: max size exceeded'));
        return;
      }

      next();
    });
  }, function (err) {
    if (err) {
      callback(err);
      return;
    }

    // Create new ObjectId for orig file.
    // You can get file_id from put function, but all previews save async.
    var origId = new Mongoose.Types.ObjectId();
    async.each(
      Object.keys(previews),
      function (key, next) {
        var data = previews[key];

        var params = { contentType: mimoza.getMimeType(data.type) };

        if (key === 'orig') {
          params._id = origId;
        } else {
          params.filename = origId + '_' + key;
        }

        File.put(data.path, params, function (err) {
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
}


module.exports = function (src, options, callback) {
  File = options.store;

  var previews = {};
  async.eachSeries(Object.keys(options.resize), function (resizeConfigKey, next) {
    // Create preview for each size

    var resizeConfig = options.resize[resizeConfigKey];
    // Next preview will be based on preview in 'from' property
    // by default next preview generated from 'orig'
    var from = (previews[resizeConfig.from || ''] || previews.orig || {});
    var filePath = from.path || src;
    createPreview(filePath, resizeConfig, from.type || options.ext, function (err, data) {
      if (err) {
        next(err);
        return;
      }

      previews[resizeConfigKey] = data;

      // Get real size after resize
      gm(data.path).size(function (err, imgSz) {
        if (err) {
          next(err);
          return;
        }

        previews[resizeConfigKey].size = { width: imgSz.width, height: imgSz.height };
        next();
      });
    });
  }, function (err) {
    // Delete all tmp files
    function deleteTmpPreviews(callback) {
      async.each(
        Object.keys(previews),
        function (key, next) {
          fs.unlink(previews[key].path, function () {
            next();
          });
        },
        function () {
          callback();
        }
      );
    }

    if (err) {
      deleteTmpPreviews(function () {
        callback(err);
      });
      return;
    }

    // Save all previews
    saveFiles(previews, options.maxSize, function (err, origId) {
      deleteTmpPreviews(function () {
        if (err) {
          callback(err);
          return;
        }

        var images = {};
        _.forEach(previews, function (val, key) {
          images[key] = val.size;
        });
        callback(null, { id: origId, size: previews.orig.fileSize, images: images });
      });
    });
  });
};
