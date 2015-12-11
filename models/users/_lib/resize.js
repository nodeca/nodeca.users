// Create asset of resized images in file store
//
// - src - buffer|path|stream
//
// - options
//   - store - storage interface
//   - ext - file extension
//   - date - timestamp for generated objectid
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

var _        = require('lodash');
var async    = require('async');
var fs       = require('fs');
var mimoza   = require('mimoza');
var Mongoose = require('mongoose');
var probe    = require('probe-image-size');
var Stream   = require('stream');
var sharp    = require('sharp');

var File;

// Limit amount of threads used for each image
sharp.concurrency(1);


// Read the file and return { buffer, width, height, length }
// of the image inside.
//
function readImage(file, callback) {
  callback = _.once(callback);

  fs.readFile(file, function (err, data) {
    if (err) {
      callback(err);
      return;
    }

    var streamBuffer = new Stream.Transform();

    streamBuffer.push(data);
    streamBuffer.end();

    probe(streamBuffer, function (err, imgSz) {
      if (err) {
        callback(err);
        return;
      }

      callback(null, {
        buffer: data,
        length: data.length,
        type:   imgSz.type,
        width:  imgSz.width,
        height: imgSz.height
      });
    });
  });
}


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
function createPreview(image, resizeConfig, imageType, callback) {
  // Is image size smaller than 'skip_size' - skip resizing;
  // this saves image as it was, including metadata like EXIF
  //
  if (resizeConfig.skip_size && image.length < resizeConfig.skip_size) {
    callback(null, { image: image, type: imageType });
    return;
  }

  var outType = resizeConfig.type || imageType;

  var sharpInstance = sharp(image.buffer);

  // Set quality only for jpeg image
  if (outType === 'jpeg') {
    sharpInstance.quality(resizeConfig.jpeg_quality).rotate();
  }

  // jpeg doesn't support alpha channel, so substitute it with white background
  if (outType === 'jpeg') {
    sharpInstance.background('white').flatten();
  }

  if (resizeConfig.unsharp) {
    sharpInstance.sharpen();
  }

  // To scale image, we calculate new width and height,
  // resize image by height, and crop by width
  var scaledHeight, scaledWidth, aspectRatio;

  if (resizeConfig.height && !resizeConfig.width) {
    // If only height is defined, scale to fit height
    // and crop by max_width
    scaledHeight = resizeConfig.height;

    var proportionalWidth = Math.floor(image.width * scaledHeight / image.height);

    if (!resizeConfig.max_width || resizeConfig.max_width > proportionalWidth) {
      scaledWidth = proportionalWidth;
    } else {
      scaledWidth = resizeConfig.max_width;
    }
  } else if (!resizeConfig.height && resizeConfig.width) {
    // If only width is defined, scale to fit width
    // and crop by max_height
    scaledWidth = resizeConfig.width;

    var proportionalHeight = Math.floor(image.height * scaledWidth / image.width);

    if (!resizeConfig.max_height || resizeConfig.max_height > proportionalHeight) {
      scaledHeight = proportionalHeight;
    } else {
      scaledHeight = resizeConfig.max_height;
    }
  } else if (resizeConfig.width && resizeConfig.height) {
    // Both width and height are defined, so we scale the image to fit
    // both width and height at the same time.
    //
    // As an example, 1000x200 image with max_width=170 and max_height=150
    // would be scaled down to 170x34
    //
    aspectRatio = image.width / image.height;

    scaledWidth = image.width;
    scaledHeight = image.height;

    if (resizeConfig.width) {
      scaledWidth = Math.min(scaledWidth, resizeConfig.width);
      scaledHeight = scaledWidth / aspectRatio;
    }

    if (resizeConfig.height) {
      scaledHeight = Math.min(scaledHeight, resizeConfig.height);
      scaledWidth = scaledHeight * aspectRatio;
    }
  } else if (resizeConfig.max_width && resizeConfig.max_height) {
    // Neither width nor height are defined, so we scale to fit
    // either max_width or max_height (not necessarily both)
    //
    // As an example, 1000x200 image with max_width=170 and max_height=150
    // would be scaled down to 750x150, and then cropped to 170x150
    //
    scaledWidth = resizeConfig.max_width;
    scaledHeight = resizeConfig.max_height;
  }

  // Prevent scaled image to be larger than the original;
  // this prevents "Invalid height (1 to 16383)" error
  // caused by thin vertical images
  //
  if (scaledWidth > image.width || scaledHeight > image.height) {
    var factor = Math.max(scaledWidth / image.width, scaledHeight / image.height);

    scaledWidth /= factor;
    scaledHeight /= factor;
  }

  sharpInstance.resize(Math.round(scaledWidth), Math.round(scaledHeight));
  sharpInstance.withoutEnlargement().crop('center');

  // TODO: save original image instead if no crop is required,
  //       but still need to do something about exif

  sharpInstance.toFormat(outType).toBuffer(function (err, buffer, info) {
    if (err) {
      callback(err);
      return;
    }

    callback(null, {
      image: {
        buffer: buffer,
        length: info.size,
        width:  info.width,
        height: info.height,
        type:   info.type
      },
      type: outType
    });
  });
}


// Save buffered images to database
//
// - previews - { orig: { path, type }, ... }
// - maxSize - maximum size to save to database
// - resizeConfig
//
// - callback - function (err, originalFileId)
//
function saveImages(previews, options, callback) {
  async.each(Object.keys(previews), function (key, next) {
    //
    // Check file size
    //
    var size = previews[key].image.length;

    if (options.maxSize && size > options.maxSize) {
      next(new Error('Can\'t save file: max size exceeded'));
      return;
    }

    next();
  }, function (err) {
    if (err) {
      callback(err);
      return;
    }

    // Create new ObjectId for orig file.
    // You can get file_id from put function, but all previews save async.
    var origId = new Mongoose.Types.ObjectId(options.date);
    async.each(Object.keys(previews), function (key, next) {
      var data = previews[key];

      var params = { contentType: mimoza.getMimeType(data.type) };

      if (key === 'orig') {
        params._id = origId;
      } else {
        params.filename = origId + '_' + key;
      }

      var image = data.image;

      File.put(image.buffer, params, function (err) {
        next(err);
      });
    },
    function (err) {
      if (err) {
        callback(err);
        return;
      }

      callback(null, origId);
    });
  });
}


module.exports = function (src, options, callback) {
  File = options.store;

  var previews = {};

  readImage(src, function (err, origImage) {
    if (err) {
      callback(err);
      return;
    }

    async.eachSeries(Object.keys(options.resize), function (resizeConfigKey, next) {
      // Create preview for each size

      var resizeConfig = options.resize[resizeConfigKey];

      // Next preview will be based on preview in 'from' property
      // by default next preview generated from 'orig'
      var from = (previews[resizeConfig.from || ''] || previews.orig || {});
      var image = from.image || origImage;

      createPreview(image, resizeConfig, from.type || options.ext, function (err, newImage) {
        if (err) {
          next(err);
          return;
        }

        previews[resizeConfigKey] = newImage;
        next();
      });
    }, function (err) {
      if (err) {
        callback(err);
        return;
      }

      // Save all previews
      saveImages(previews, options, function (err, origId) {
        if (err) {
          callback(err);
          return;
        }

        callback(null, {
          id: origId,
          size: previews.orig.image.length,
          images: _.mapValues(previews, function (preview) {
            return {
              width:  preview.image.width,
              height: preview.image.height,
              length: preview.image.length
            };
          })
        });
      });
    });
  });
};
