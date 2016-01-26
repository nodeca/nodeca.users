// Change avatar dialog
//

/*global window*/

'use strict';


var _        = require('lodash');
var pica     = require('pica');

var readExif = require('nodeca.users/lib/exif');


// Avatar upload finish callback
var onUploaded;

// Original image & it's sizes (sizes are calculated after orientation update)
var image, imageWidth, imageHeight;

// Avatar size config
var avatarWidth = '$$ N.config.users.avatars.resize.orig.width $$';
var avatarHeight = '$$ N.config.users.avatars.resize.orig.height $$';

var previewWidth = '$$ N.config.users.avatars.resize.md.width $$';
var previewHeight = '$$ N.config.users.avatars.resize.md.height $$';

// Cropped image box. Absolute coordinates,
// relative to not scaled original image (drawn in css-scaled canvas)
var cropperTop,
    cropperRight,
    cropperBottom,
    cropperLeft,
    // Cropper size
    cropperMinHeight,
    cropperMinWidth,
    // Canvas shift + real scale
    viewOffsetX,  // viewport (canvas) offset from parent element
    viewOffsetY,
    viewRatio;    // viewport (canvas) scale (canvas max-width limited with css)

// Dialog data (data.avatar_id will be filled after upload)
var data;

// Dialog elements
var $dialog, cropper, canvas, canvasPreview, canvasPreviewCtx;

// Timer to detect zoom and dialog size change
var sizeCheckInterval;


///////////////////////////////////////////////////////////////////////////////
// Redraw cropper frame

var redrawCropperStarted = false;

function _cropperUpdate() {
  cropper.style.top = (cropperTop * viewRatio + viewOffsetY) + 'px';
  cropper.style.left = (cropperLeft * viewRatio + viewOffsetX) + 'px';
  cropper.style.width = (cropperRight - cropperLeft) * viewRatio + 'px';
  cropper.style.height = (cropperBottom - cropperTop) * viewRatio + 'px';

  redrawCropperStarted = false;
}

var cropperUpdate = _.debounce(function () {
  if (!redrawCropperStarted) {
    redrawCropperStarted = true;
    window.requestAnimationFrame(_cropperUpdate);
  }
}, 10, { maxWait: 20 });


///////////////////////////////////////////////////////////////////////////////
// Redraw preview canvas

var redrawPreviewStarted = false;

// Redraw lock. Incremented on each new request, to discard previous results
var redrawHqLastId = 0;

// Built high quality avatar preview. This is slow, do
// it only after user stopped cropper change
var previewHqUpdate = _.debounce(function () {
  var redrawId = redrawHqLastId;

  var width = cropperRight - cropperLeft;
  var height = cropperBottom - cropperTop;

  var ctx = canvas.getContext('2d');

  // Get ImageData object contains cropped image
  var croppedImageData = ctx.getImageData(cropperLeft, cropperTop, width, height);

  var previewImageData = canvasPreviewCtx.createImageData(previewWidth, previewHeight);

  // Resize to preview size
  pica.resizeBuffer({
    src: croppedImageData.data,
    width,
    height,
    toWidth: previewWidth,
    toHeight: previewHeight,
    quality: 3,
    dest: previewImageData.data,
    unsharpThreshold: 10,
    __unsharpAmount: 60,
    transferable: true
  }, function (err) {

    if (err) {
      return;
    }

    // Check that no new resizes requested, until we processed
    // this one. If new request happened - just ignore old data.
    if (redrawId === redrawHqLastId) {
      canvasPreviewCtx.putImageData(previewImageData, 0, 0);
    }
  });

}, 500);

// Build real-time preview on cropper change. Fast, but low quality (pixelated)
function _previewUpdate() {
  canvasPreviewCtx.drawImage(
    canvas,
    cropperLeft,
    cropperTop,
    cropperRight - cropperLeft,
    cropperBottom - cropperTop,
    0,
    0,
    previewWidth,
    previewHeight
  );

  // Check is web worker available in browser
  if (pica.WW) {
    redrawHqLastId++;
    previewHqUpdate();
  }

  redrawPreviewStarted = false;
}

var previewUpdate = _.debounce(function () {
  if (!redrawPreviewStarted) {
    redrawPreviewStarted = true;
    window.requestAnimationFrame(_previewUpdate);
  }
}, 20, { maxWait: 40 });

///////////////////////////////////////////////////////////////////////////////


// Return number, restricted to range [min..max]
//
function clamp(number, min, max) {
  return Math.max(min, Math.min(number, max));
}


// Calculate new cropper coords on `move`
//
function cropperDrag(cropperClickOffsetX, cropperClickOffsetY, mouseX, mouseY) {
  var left, top;

  var width = cropperRight - cropperLeft;
  var height = cropperBottom - cropperTop;

  left = mouseX - cropperClickOffsetX;
  top = mouseY - cropperClickOffsetY;

  cropperLeft = Math.round(clamp(left, 0, imageWidth - width));
  cropperTop = Math.round(clamp(top, 0, imageHeight - height));
  cropperRight = Math.round(cropperLeft + width);
  cropperBottom = Math.round(cropperTop + height);
}


// Calculate new cropper coords on `resize`
//
function cropperResize(mouseX, mouseY, dir) {
  var ratio = avatarWidth / avatarHeight;

  var left, top, right, bottom;
  var refX, refY;
  var maxLeft, maxRight, maxTop, maxBottom, minLeft, minRight, minTop, minBottom, widthHalf, heightHalf;

  switch (dir) {
    case 's':
      // The middle of top cropper border
      refX = cropperLeft + (cropperRight - cropperLeft) / 2;
      refY = cropperTop;
      maxBottom = imageHeight;
      minBottom = refY + cropperMinHeight;
      bottom = clamp(mouseY, minBottom, maxBottom);
      top = refY;
      left = refX - (bottom - top) * ratio / 2;
      right = refX + (bottom - top) * ratio / 2;

      if (left < 0 || right > imageWidth) {
        widthHalf = Math.min(refX - Math.max(left, 0), Math.min(imageWidth, right) - refX);
        left = refX - widthHalf;
        right = refX + widthHalf;
        bottom = top + (right - left) / ratio;
      }

      break;

    case 'n':
      // The middle of bottom cropper border
      refX = cropperLeft + (cropperRight - cropperLeft) / 2;
      refY = cropperBottom;
      minTop = 0;
      maxTop = refY - cropperMinHeight;
      top = clamp(mouseY, minTop, maxTop);
      bottom = refY;
      left = refX - (bottom - top) * ratio / 2;
      right = refX + (bottom - top) * ratio / 2;

      if (left < 0 || right > imageWidth) {
        widthHalf = Math.min(refX - Math.max(left, 0), Math.min(imageWidth, right) - refX);
        left = refX - widthHalf;
        right = refX + widthHalf;
        top = bottom - (right - left) / ratio;
      }

      break;

    case 'w':
      // The middle of right cropper border
      refX = cropperRight;
      refY = cropperTop + (cropperBottom - cropperTop) / 2;
      minLeft = 0;
      maxLeft = refX - cropperMinWidth;
      left = clamp(mouseX, minLeft, maxLeft);
      right = refX;
      top = refY - (right - left) / ratio / 2;
      bottom = refY + (right - left) / ratio / 2;

      if (top < 0 || bottom > imageHeight) {
        heightHalf = Math.min(refY - Math.max(top, 0), Math.min(imageHeight, bottom) - refY);
        top = refY - heightHalf;
        bottom = refY + heightHalf;
        left = right - (bottom - top) * ratio;
      }

      break;

    case 'e':
      // The middle of left cropper border
      refX = cropperLeft;
      refY = cropperTop + (cropperBottom - cropperTop) / 2;
      minRight = refX + cropperMinWidth;
      maxRight = imageWidth;
      right = clamp(mouseX, minRight, maxRight);
      left = refX;
      top = refY - (right - left) / ratio / 2;
      bottom = refY + (right - left) / ratio / 2;

      if (top < 0 || bottom > imageHeight) {
        heightHalf = Math.min(refY - Math.max(top, 0), Math.min(imageHeight, bottom) - refY);
        top = refY - heightHalf;
        bottom = refY + heightHalf;
        right = left + (bottom - top) * ratio;
      }

      break;

    case 'se':
      // Top left corner
      refX = cropperLeft;
      refY = cropperTop;
      minRight = refX + cropperMinWidth;
      maxRight = imageWidth;
      right = clamp(mouseX, minRight, maxRight);
      left = refX;
      top = refY;
      bottom = refY + (right - left) / ratio;

      if (bottom > imageHeight) {
        bottom = imageHeight;
        right = refX + (bottom - top) * ratio;
      }

      break;

    case 'nw':
      // Bottom right corner
      refX = cropperRight;
      refY = cropperBottom;
      minLeft = 0;
      maxLeft = refX - cropperMinWidth;
      left = clamp(mouseX, minLeft, maxLeft);
      right = refX;
      bottom = refY;
      top = refY - (right - left) / ratio;

      if (top < 0) {
        top = 0;
        left = refX - (bottom - top) * ratio;
      }

      break;

    case 'ne':
      // Bottom right corner
      refX = cropperLeft;
      refY = cropperBottom;
      minTop = 0;
      maxTop = refY - cropperMinHeight;
      top = clamp(mouseY, minTop, maxTop);
      left = refX;
      bottom = refY;
      right = refX + (bottom - top) * ratio;

      if (right > imageWidth) {
        right = imageWidth;
        top = refY - (right - left) / ratio;
      }

      break;

    case 'sw':
      // Right top corner
      refX = cropperRight;
      refY = cropperTop;
      minBottom = refY + cropperMinHeight;
      maxBottom = imageHeight;
      bottom = clamp(mouseY, minBottom, maxBottom);
      right = refX;
      top = refY;
      left = refX - (bottom - top) * ratio;

      if (left < 0) {
        left = 0;
        bottom = refY + (right - left) / ratio;
      }

      break;

    default:
      return;
  }

  cropperBottom = Math.round(bottom);
  cropperRight = Math.round(right);
  cropperTop = Math.round(top);
  cropperLeft = Math.round(left);
}


// Apply JPEG orientation to canvas. Define flip/rotate transformation
// on context and swap canvas width/height if needed
//
function orientationApply(canvas, ctx, orientation) {
  var width = canvas.width;
  var height = canvas.height;

  if (!orientation || orientation > 8) {
    return;
  }

  if (orientation > 4) {
    canvas.width = height;
    canvas.height = width;
  }

  switch (orientation) {

    case 2:
      // Horizontal flip
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      break;

    case 3:
      // rotate 180 degrees left
      ctx.translate(width, height);
      ctx.rotate(Math.PI);
      break;

    case 4:
      // Vertical flip
      ctx.translate(0, height);
      ctx.scale(1, -1);
      break;

    case 5:
      // Vertical flip + rotate right
      ctx.rotate(0.5 * Math.PI);
      ctx.scale(1, -1);
      break;

    case 6:
      // Rotate right
      ctx.rotate(0.5 * Math.PI);
      ctx.translate(0, -height);
      break;

    case 7:
      // Horizontal flip + rotate right
      ctx.rotate(0.5 * Math.PI);
      ctx.translate(width, -height);
      ctx.scale(-1, 1);
      break;

    case 8:
      // Rotate left
      ctx.rotate(-0.5 * Math.PI);
      ctx.translate(-width, 0);
      break;

    default:
  }
}


// Update viewRatio, viewOffsetX, viewOffsetY, cropperMinWidth, cropperMinHeight on image load & window resize
//
function viewParamsUpdate() {
  viewOffsetX = canvas.offsetLeft;
  viewOffsetY = canvas.offsetTop;

  viewRatio = canvas.offsetWidth / imageWidth;

  // Cropper size should be bigger than 3x resize mark (to user be able interact with marks)
  cropperMinWidth = Math.max(avatarWidth, Math.round($dialog.find('.avatar-cropper__mark').width() * 3 / viewRatio));
  cropperMinHeight = Math.max(avatarHeight, Math.round($dialog.find('.avatar-cropper__mark').height() * 3 / viewRatio));
}


// Load image from user's file
//
function loadImage(file) {
  var ctx = canvas.getContext('2d');
  var orientation;

  image = new Image();

  image.onerror = function () {
    N.wire.emit('notify', t('err_image_invalid'));
  };

  image.onload = function () {

    if (image.width < avatarWidth || image.height < avatarHeight) {
      N.wire.emit('notify', t('err_invalid_size', { w: avatarWidth, h: avatarHeight }));
      return;
    }

    canvas.width  = image.width;
    canvas.height = image.height;

    orientationApply(canvas, ctx, orientation);

    imageWidth = canvas.width;
    imageHeight = canvas.height;

    ctx.drawImage(image, 0, 0, image.width, image.height);

    $('.avatar-change').addClass('avatar-change__m-loaded');

    viewParamsUpdate();

    // Init crop area box (center of image)
    var size = Math.max(Math.floor(Math.min(imageWidth, imageHeight) / 4), Math.max(avatarWidth, avatarHeight));
    cropperLeft = Math.floor(imageWidth / 2 - size / 2);
    cropperTop = Math.floor(imageHeight / 2 - size / 2);
    cropperBottom = cropperTop + size;
    cropperRight = cropperLeft + size;

    cropperUpdate();
    previewUpdate();
  };

  var slice = file.slice || file.webkitSlice || file.mozSlice;
  var maxMetadataSize = Math.min(file.size, 256 * 1024);
  var reader = new FileReader();

  reader.onloadend = function (e) {
    var exifData = readExif(new Uint8Array(e.target.result));

    if (exifData && exifData.orientation) {
      orientation = exifData.orientation;
    }

    image.src = window.URL.createObjectURL(file);
  };

  reader.readAsArrayBuffer(slice.call(file, 0, maxMetadataSize));
}


// Init cropper
//
// - set handler to track touch/click point, when action started
// - track if mouse goes out of window
//
function initCropper() {
  var cropperClickOffsetX, cropperClickOffsetY, action;
  var $body = $('body');

  // Use `body` selector for listen mouse events outside of dialog
  $body
    .on('mouseup.nd.avatar_change touchend.nd.avatar_change', function () {
      $dialog.removeClass('avatar-dialog__m-cursor-' + action);
      $dialog.removeClass('avatar-dialog__m-crop-active');
      action = null;
    })
    .on('mousemove.nd.avatar_change touchmove.nd.avatar_change', function (event) {

      if (!action) {
        return;
      }

      // Detect mouse button up for case when `mouseup` event happens
      // out of browser window. Check current state directly. Skip this check
      // for touch events, because they have invalid mouse buttons values.
      // `event.which` works in chrome, `event.buttons` in firefox
      if (event.type === 'mousemove' && (event.which === 0 || event.buttons === 0)) {
        $dialog.removeClass('avatar-dialog__m-cursor-' + action);
        $dialog.removeClass('avatar-dialog__m-crop-active');
        action = null;
        return;
      }

      var canvasRect = canvas.getBoundingClientRect();
      var point = event.originalEvent.touches ? event.originalEvent.touches[0] : event;
      var mouseX = (point.pageX - canvasRect.left) / viewRatio;
      var mouseY = (point.pageY - canvasRect.top) / viewRatio;

      if (action !== 'move') {
        cropperResize(mouseX, mouseY, action);
      } else {
        cropperDrag(cropperClickOffsetX, cropperClickOffsetY, mouseX, mouseY);
      }

      cropperUpdate();
      previewUpdate();
    });

  $(cropper).on('mousedown touchstart', function (event) {
    var $target = $(event.target);
    var point = event.originalEvent.touches ? event.originalEvent.touches[0] : event;

    var canvasRect = canvas.getBoundingClientRect();
    cropperClickOffsetX = (point.pageX - canvasRect.left) / viewRatio - cropperLeft;
    cropperClickOffsetY = (point.pageY - canvasRect.top) / viewRatio - cropperTop;

    if (!action) {
      action = $target.data('action');
      $dialog.addClass('avatar-dialog__m-cursor-' + action);
      $dialog.addClass('avatar-dialog__m-crop-active');
    }

    return false;
  });
}


// Init event handlers
//
N.wire.once('users.avatar.change', function init_event_handlers() {

  // Show system dialog file selection
  //
  N.wire.on('users.avatar.change:select_file', function select_file() {
    $('.avatar-change__upload').click();
  });


  // Handles the event when user drag file to drag drop zone
  //
  N.wire.on('users.avatar.change:dd_area', function change_avatar_dd(data) {
    var x0, y0, x1, y1, ex, ey;
    var $dropZone = $('.avatar-change');

    switch (data.event.type) {
      case 'dragenter':
        $dropZone.addClass('active');
        break;
      case 'dragleave':
        // 'dragleave' occurs when user move cursor over child HTML element
        // track this situation and don't remove 'active' class
        // http://stackoverflow.com/questions/10867506/
        x0 = $dropZone.offset().left;
        y0 = $dropZone.offset().top;
        x1 = x0 + $dropZone.outerWidth();
        y1 = y0 + $dropZone.outerHeight();
        ex = data.event.originalEvent.pageX;
        ey = data.event.originalEvent.pageY;

        if (ex > x1 || ex < x0 || ey > y1 || ey < y0) {
          $dropZone.removeClass('active');
        }
        break;
      case 'drop':
        $dropZone.removeClass('active');

        if (data.event.dataTransfer && data.event.dataTransfer.files && data.event.dataTransfer.files.length) {
          loadImage(data.event.dataTransfer.files[0]);
        }
        break;
      default:
    }
  });


  ///////////////////////////////////////////////////////////////////////////////
  // Save selected avatar

  var formData;

  N.wire.on('users.avatar.change:apply', function change_avatar_resize(__, callback) {

    var ctx = canvas.getContext('2d');
    var width = cropperRight - cropperLeft;
    var height = cropperBottom - cropperTop;
    var croppedImageData = ctx.getImageData(cropperLeft, cropperTop, width, height);

    var avatarCanvas = document.createElement('canvas');
    var avatarCanvasCtx = avatarCanvas.getContext('2d');

    avatarCanvas.width = avatarWidth;
    avatarCanvas.height = avatarHeight;

    var avatarImageData = avatarCanvasCtx.createImageData(avatarWidth, avatarHeight);

    pica.resizeBuffer({
      src: croppedImageData.data,
      width,
      height,
      toWidth: avatarWidth,
      toHeight: avatarHeight,
      quality: 3,
      dest: avatarImageData.data,
      transferable: true
    }, function (err) {

      if (err) {
        N.wire.emit('notify', t('err_image_invalid'));
        return;
      }

      avatarCanvasCtx.putImageData(avatarImageData, 0, 0);

      avatarCanvas.toBlob(function (blob) {

        formData = new FormData();
        formData.append('file', blob);
        formData.append('csrf', N.runtime.token_csrf);

        callback();

      }, 'image/jpeg', 90);
    });
  });

  N.wire.after('users.avatar.change:apply', function change_avatar_upload() {

    // Upload resizd avatar
    $.ajax({
      url: N.router.linkTo('users.avatar.upload'),
      type: 'POST',
      data: formData,
      dataType: 'json',
      processData: false,
      contentType: false
    })
      .done(function (result) {
        data.avatar_id = result.avatar_id;
        $dialog.modal('hide');
        onUploaded();
      })
      .fail(function () {
        $dialog.modal('hide');
        N.wire.emit('notify', t('err_upload_failed'));
      })
      .always(function () {
        formData = null;
      });
  });


  // Page exit
  //
  N.wire.on('navigate.exit', function page_exit() {
    if (!$dialog) {
      return;
    }

    clearInterval(sizeCheckInterval);

    $dialog.remove();

    $('body').off('.nd.avatar_change');
    $(window).off('.nd.avatar_change');

    // Free resources
    onUploaded = null;
    image = null;
    $dialog = null;
    cropper = null;
    canvas = null;
    canvasPreview = null;
    canvasPreviewCtx = null;
  });
});


// Init dialog on event
//
N.wire.on('users.avatar.change', function show_change_avatar(params, callback) {
  data = params;
  onUploaded = callback;

  // If dialog already exists - just show,
  // it allows to keep already uploaded image
  if ($dialog) {
    $dialog.modal('show');
    return;
  }

  $dialog = $(N.runtime.render('users.avatar.change'));
  $('body').append($dialog);

  cropper = $('.avatar-cropper')[0];
  canvas = $('.avatar-change__canvas')[0];

  canvasPreview = $('.avatar-preview')[0];
  canvasPreview.width = previewWidth;
  canvasPreview.height = previewHeight;
  canvasPreviewCtx = canvasPreview.getContext('2d');

  initCropper();

  var lastWidth = $dialog.width();

  // We can't use `resize` event here because zoom level also change width, but doesn't fire `resize`
  sizeCheckInterval = setInterval(function () {
    var newWidth = $dialog.width();

    if (lastWidth === newWidth) {
      return;
    }

    lastWidth = newWidth;

    viewParamsUpdate();
    cropperUpdate();
  }, 500);

  $('.avatar-change__upload').on('change', function () {
    var files = $(this)[0].files;
    if (files.length > 0) {
      loadImage(files[0]);
    }
  });

  // Update cropper on dialog open.
  // Needed when we open dialog at second time with existing image
  $dialog.on('shown.bs.modal', function () {
    viewParamsUpdate();
    cropperUpdate();
  });

  $dialog.modal('show');
});
