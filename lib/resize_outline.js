// Calculate size of an uploaded image to match settings defined
// in the config file
//
//   - width - original image width
//   - height - original image height
//   - resizeConfig
//     - width
//     - height
//     - max_width
//     - max_height
//     - jpeg_quality (unused)
//     - gif_animation (unused)
//     - skip_size (unused)
//
// Returns:
//   - width - scaled width
//   - height - scaled height
//
'use strict';

module.exports = function (width, height, resizeConfig) {
  // To scale image, we calculate new width and height,
  // resize image by height, and crop by width
  let scaledWidth, scaledHeight, cropWidth, cropHeight;

  if (resizeConfig.height && !resizeConfig.width) {
    // If only height is defined, scale to fit height
    // and crop by max_width
    scaledHeight = resizeConfig.height;

    let proportionalWidth = width * scaledHeight / height;

    if (!resizeConfig.max_width || resizeConfig.max_width > proportionalWidth) {
      scaledWidth = proportionalWidth;
    } else {
      scaledWidth = resizeConfig.max_width;
    }

    // Prevent scaled image from being larger than the original
    if (scaledWidth > width || scaledHeight > height) {
      let factor = Math.max(scaledWidth / width, scaledHeight / height);

      scaledWidth  /= factor;
      scaledHeight /= factor;
    }

    scaledWidth  = Math.round(scaledWidth);
    scaledHeight = Math.round(scaledHeight);
    cropWidth    = scaledWidth;
    cropHeight   = scaledHeight;

  } else if (!resizeConfig.height && resizeConfig.width) {
    // If only width is defined, scale to fit width
    // and crop by max_height
    scaledWidth = resizeConfig.width;

    let proportionalHeight = height * scaledWidth / width;

    if (!resizeConfig.max_height || resizeConfig.max_height > proportionalHeight) {
      scaledHeight = proportionalHeight;
    } else {
      scaledHeight = resizeConfig.max_height;
    }

    // Prevent scaled image from being larger than the original
    if (scaledWidth > width || scaledHeight > height) {
      let factor = Math.max(scaledWidth / width, scaledHeight / height);

      scaledWidth  /= factor;
      scaledHeight /= factor;
    }

    scaledWidth  = Math.round(scaledWidth);
    scaledHeight = Math.round(scaledHeight);
    cropWidth    = scaledWidth;
    cropHeight   = scaledHeight;

  } else if (resizeConfig.width && resizeConfig.height) {
    // Both width and height are defined, so we scale the image to fit
    // both width and height at the same time.
    //
    // As an example, 1000x200 image with max_width=170 and max_height=150
    // would be scaled down to 170x34
    //
    let aspectRatio = width / height;

    scaledWidth  = width;
    scaledHeight = height;

    if (resizeConfig.width) {
      scaledWidth  = Math.min(scaledWidth, resizeConfig.width);
      scaledHeight = scaledWidth / aspectRatio;
    }

    if (resizeConfig.height) {
      scaledHeight = Math.min(scaledHeight, resizeConfig.height);
      scaledWidth  = scaledHeight * aspectRatio;
    }

    // Prevent scaled image from being larger than the original
    if (scaledWidth > width || scaledHeight > height) {
      let factor = Math.max(scaledWidth / width, scaledHeight / height);

      scaledWidth  /= factor;
      scaledHeight /= factor;
    }

    scaledWidth  = Math.round(scaledWidth);
    scaledHeight = Math.round(scaledHeight);
    cropWidth    = scaledWidth;
    cropHeight   = scaledHeight;

  } else if (resizeConfig.max_width && resizeConfig.max_height) {
    // Neither width nor height are defined, so we scale to fit
    // either max_width or max_height (not necessarily both)
    //
    // As an example, 1000x200 image with max_width=170 and max_height=150
    // would be scaled down to 750x150, and then cropped to 170x150
    //
    cropWidth  = Math.min(resizeConfig.max_width, width);
    cropHeight = Math.min(resizeConfig.max_height, height);

    let factor = Math.max(cropWidth / width, cropHeight / height);

    scaledWidth  = Math.round(width * factor);
    scaledHeight = Math.round(height * factor);
  }

  return {
    resize_width:  scaledWidth,
    resize_height: scaledHeight,
    crop_width:    cropWidth,
    crop_height:   cropHeight
  };
};
