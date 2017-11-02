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
// Returns Promise:
//
// {
//   id: ObjectId,
//   size: Number,
//   images: { orig: { width: Number , height: Number } }
// }
//
'use strict';

const _              = require('lodash');
const from2          = require('from2');
const readFile       = require('util').promisify(require('fs').readFile);
const mime           = require('mime-types').lookup;
const Mongoose       = require('mongoose');
const pump           = require('util').promisify(require('pump'));
const stream         = require('readable-stream');
const sharp          = require('sharp');
const through2       = require('through2');
const filter_jpeg    = require('nodeca.users/lib/filter_jpeg');
const probe          = require('probe-image-size');
const resize_outline = require('nodeca.users/lib/resize_outline');


let File;

// Limit amount of threads used for each image
sharp.concurrency(1);


// Stream2 interface for jpeg_stream
//
function filter_jpeg_stream(options) {
  let filter = filter_jpeg(options);

  let stream = through2(function write(chunk, __, callback) {
    filter.push(chunk);
    callback();
  }, function flush(callback) {
    filter.end();
    callback();
  });

  filter.onData = data => { stream.push(data); };
  filter.onEnd  = ()   => { stream.push(null); };

  return stream;
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
async function createPreview(image, resizeConfig, imageType) {
  // To scale image, we calculate new width and height,
  // resize image by height, and crop by width
  let saveAsIs = false;

  let u = resize_outline(image.width, image.height, resizeConfig);
  let scaledWidth = u.crop_width;
  let scaledHeight = u.crop_height;

  let outType = resizeConfig.type || imageType;

  if (imageType === outType) {
    // If image size is smaller than 'skip_size', skip resizing;
    // this saves image as is, including metadata like EXIF
    //
    if (resizeConfig.skip_size && image.length < resizeConfig.skip_size) {
      saveAsIs = true;
    }

    // If image is smaller than needed already, save it as is
    //
    if (scaledWidth >= image.width && scaledHeight >= image.height) {
      if (!resizeConfig.max_size || image.length < resizeConfig.max_size) {
        saveAsIs = true;
      }
    }
  }

  // Do not repack small non-jpeg images,
  // we always process jpegs to fix orientation
  //
  if (saveAsIs && imageType !== 'jpeg') {
    return { image, type: imageType };
  }

  let sharpInstance = sharp(image.buffer);
  let formatOptions = {};

  if (outType === 'jpeg') {
    // Set quality for jpeg image (default sharp quality is 80)
    formatOptions.quality = resizeConfig.jpeg_quality;

    // Rotate image / fix Exif orientation
    sharpInstance.rotate();

    // Jpeg doesn't support alpha channel, so substitute it with white background
    if (imageType === 'gif' || imageType === 'png') {
      sharpInstance.background('white').flatten();
    }
  }

  if (!saveAsIs) {
    if (resizeConfig.unsharp) {
      sharpInstance.sharpen();
    }

    sharpInstance.resize(Math.round(scaledWidth), Math.round(scaledHeight));
    sharpInstance.withoutEnlargement().crop(sharp.strategy.attention);
  }

  let res = await sharpInstance.toFormat(outType, formatOptions)
                               .withMetadata()
                               .toBuffer({ resolveWithObject: true });

  return {
    image: {
      buffer: res.data,
      length: res.info.size,
      width:  res.info.width,
      height: res.info.height,
      type:   res.info.type
    },
    type: outType
  };
}


// Save buffered images to database
//
// - previews - { orig: { path, type }, ... }
// - maxSize - maximum size to save to database
// - resizeConfig
//
// - callback - function (err, originalFileId)
//
async function saveImages(previews, options) {
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

    let filter = (data.image.buffer[0] === 0xFF && data.image.buffer[1] === 0xD8) ?
                 filter_jpeg_stream({
                   filter:     true,
                   removeICC:  key === 'sm' ? true : null,
                   removeExif: key === 'sm' ? true : null,
                   comment:    key === 'sm' ? null : options.comment
                 }) :
                 through2();

    await pump(
      from2([ data.image.buffer ]),
      filter,
      File.createWriteStream(params)
    );
  }

  return origId;
}


module.exports = async function (src, options) {
  File = options.store;

  let previews = {};

  //
  // Read image from file, determine its size
  //
  let data = await readFile(src);
  let streamBuffer = new stream.Transform();

  streamBuffer.push(data);
  streamBuffer.end();

  let imgSz = await probe(streamBuffer);

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

    let newImage = await createPreview(image, resizeConfig, from.type || options.ext);

    previews[resizeConfigKey] = newImage;
  }

  // Save all previews
  let origId = await saveImages(previews, options);

  return {
    id: origId,
    size: previews.orig.image.length,
    images: _.mapValues(previews, preview => ({
      width:  preview.image.width,
      height: preview.image.height,
      length: preview.image.length
    }))
  };
};
