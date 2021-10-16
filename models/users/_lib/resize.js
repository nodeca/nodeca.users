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
const { readFile }   = require('fs/promises');
const mime           = require('mime-types').lookup;
const Mongoose       = require('mongoose');
const sharp          = require('sharp');
const image_traverse = require('image-blob-reduce/lib/image_traverse.js');
const resize_outline = require('nodeca.users/lib/resize_outline');


// Limit amount of threads used for each image
// sharp.concurrency(1);


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
      sharpInstance.flatten({ background: 'white' });
    }
  }

  if (!saveAsIs) {
    if (resizeConfig.unsharp) {
      sharpInstance.sharpen();
    }

    sharpInstance.resize(Math.round(scaledWidth), Math.round(scaledHeight), {
      fit: 'cover',
      position: 'attention',
      withoutEnlargement: true
    });
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


// Remove all metadata (Exif, ICC, photoshop stuff, etc.)
//
function filterJpegPreview(buffer) {
  buffer = image_traverse.jpeg_segments_filter(buffer, segment => {
    if (segment.id >= 0xE1 && segment.id < 0xF0) return false;
    return true;
  });

  return buffer;
}


// Remove metadata (ICC, photoshop stuff, etc.), and filter exif
//
function filterJpegImage(buffer, comment) {
  buffer = image_traverse.jpeg_segments_filter(buffer, segment => {
    if (segment.id >= 0xE2 && segment.id < 0xF0) return false;
    return true;
  });

  buffer = image_traverse.jpeg_exif_tags_filter(buffer, entry => {
    return entry.data_length < 100;
  });

  if (comment) {
    buffer = image_traverse.jpeg_add_comment(buffer, comment);
  }

  return buffer;
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

    let buffer = data.image.buffer;

    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
      if (key === 'sm') {
        buffer = filterJpegPreview(buffer, options.comment);
      } else {
        buffer = filterJpegImage(buffer, options.comment);
      }
    }

    await options.store.put(Buffer.from(buffer), params);
  }

  return origId;
}


module.exports = async function (src, options) {
  let previews = {};

  //
  // Read image from file, determine its size
  //
  let data = await readFile(src);
  let imgSz = await sharp(data).metadata();

  let origImage = {
    buffer: data,
    length: imgSz.size,
    width:  imgSz.width,
    height: imgSz.height,
    type:   imgSz.type
  };

  if (imgSz.orientation >= 5) {
    [ origImage.width, origImage.height ] = [ origImage.height, origImage.width ];
  }

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
