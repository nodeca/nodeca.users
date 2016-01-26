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

const _        = require('lodash');
const co       = require('co');
const fs       = require('mz/fs');
const mime     = require('mime-types').lookup;
const Mongoose = require('mongoose');
const stream   = require('readable-stream');
const sharp    = require('sharp');
const thenify  = require('thenify');
const probe    = thenify(require('probe-image-size'));

let File;

// Limit amount of threads used for each image
sharp.concurrency(1);


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
const createPreview = co.wrap(function* (image, resizeConfig, imageType) {
  // To scale image, we calculate new width and height,
  // resize image by height, and crop by width
  let scaledHeight, scaledWidth;

  if (resizeConfig.height && !resizeConfig.width) {
    // If only height is defined, scale to fit height
    // and crop by max_width
    scaledHeight = resizeConfig.height;

    let proportionalWidth = Math.floor(image.width * scaledHeight / image.height);

    if (!resizeConfig.max_width || resizeConfig.max_width > proportionalWidth) {
      scaledWidth = proportionalWidth;
    } else {
      scaledWidth = resizeConfig.max_width;
    }
  } else if (!resizeConfig.height && resizeConfig.width) {
    // If only width is defined, scale to fit width
    // and crop by max_height
    scaledWidth = resizeConfig.width;

    let proportionalHeight = Math.floor(image.height * scaledWidth / image.width);

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
    let aspectRatio = image.width / image.height;

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

  // If image size is smaller than 'skip_size', skip resizing;
  // this saves image as is, including metadata like EXIF
  //
  if (resizeConfig.skip_size && image.length < resizeConfig.skip_size) {
    return { image: image, type: imageType };
  }

  // If image is smaller than needed already, save it as is
  //
  if (scaledWidth >= image.width && scaledHeight >= image.height) {
    if (!resizeConfig.max_size || image.length < resizeConfig.max_size) {
      return { image: image, type: imageType };
    }
  }

  let outType = resizeConfig.type || imageType;

  let sharpInstance = sharp(image.buffer);

  // Set quality only for jpeg image
  if (outType === 'jpeg') {
    sharpInstance.quality(resizeConfig.jpeg_quality).rotate();
  }

  // jpeg doesn't support alpha channel, so substitute it with white background
  if (outType === 'jpeg') {
    if (imageType === 'gif' || imageType === 'png') {
      sharpInstance.background('white').flatten();
    }
  }

  if (resizeConfig.unsharp) {
    sharpInstance.sharpen();
  }

  // Prevent scaled image to be larger than the original;
  // this prevents "Invalid height (1 to 16383)" error
  // caused by thin vertical images
  //
  if (scaledWidth > image.width || scaledHeight > image.height) {
    let factor = Math.max(scaledWidth / image.width, scaledHeight / image.height);

    scaledWidth /= factor;
    scaledHeight /= factor;
  }

  sharpInstance.resize(Math.round(scaledWidth), Math.round(scaledHeight));
  sharpInstance.withoutEnlargement().crop('center');

  let res = yield new Promise((resolve, reject) => {
    // using callback interface instead of promises here,
    // because promises don't return `info` object
    sharpInstance.toFormat(outType).toBuffer(function (err, buffer, info) {
      if (err) {
        reject(err);
        return;
      }

      resolve({ buffer: buffer, info: info });
    });
  });

  return {
    image: {
      buffer: res.buffer,
      length: res.info.size,
      width:  res.info.width,
      height: res.info.height,
      type:   res.info.type
    },
    type: outType
  };
});


// Save buffered images to database
//
// - previews - { orig: { path, type }, ... }
// - maxSize - maximum size to save to database
// - resizeConfig
//
// - callback - function (err, originalFileId)
//
const saveImages = co.wrap(function* (previews, options) {
  let keys = Object.keys(previews);

  //
  // Check file size
  //
  for (let i = 0; i < keys.length; i++) {
    let size = previews[keys[i]].image.length;

    if (options.maxSize && size > options.maxSize) {
      throw new Error('Can\'t save file: max size exceeded');
    }
  }

  // Create new ObjectId for orig file.
  // You can get file_id from put function, but all previews save async.
  let origId = new Mongoose.Types.ObjectId(options.date);

  for (let i = 0; i < keys.length; i++) {
    let key = keys[i];
    let data = previews[key];
    let params = { contentType: mime(data.type) };

    if (key === 'orig') {
      params._id = origId;
    } else {
      params.filename = origId + '_' + key;
    }

    yield File.put(data.image.buffer, params);
  }

  return origId;
});


module.exports = co.wrap(function* (src, options) {
  File = options.store;

  let previews = {};

  //
  // Read image from file, determine its size
  //
  let data = yield fs.readFile(src);
  let streamBuffer = new stream.Transform();

  streamBuffer.push(data);
  streamBuffer.end();

  let imgSz = yield probe(streamBuffer);
  let origImage = {
    buffer: data,
    length: data.length,
    type:   imgSz.type,
    width:  imgSz.width,
    height: imgSz.height
  };

  let resizeConfigKeys = Object.keys(options.resize);

  for (let i = 0; i < resizeConfigKeys.length; i++) {
    let resizeConfigKey = resizeConfigKeys[i];

    // Create preview for each size

    let resizeConfig = options.resize[resizeConfigKey];

    // Next preview will be based on preview in 'from' property
    // by default next preview generated from 'orig'
    let from = (previews[resizeConfig.from || ''] || previews.orig || {});
    let image = from.image || origImage;

    let newImage = yield createPreview(image, resizeConfig, from.type || options.ext);

    previews[resizeConfigKey] = newImage;
  }

  // Save all previews
  let origId = yield saveImages(previews, options);

  return {
    id: origId,
    size: previews.orig.image.length,
    images: _.mapValues(previews, preview => ({
      width:  preview.image.width,
      height: preview.image.height,
      length: preview.image.length
    }))
  };
});
