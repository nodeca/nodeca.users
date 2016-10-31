// Change avatar dialog
//

/*global window*/

'use strict';


const _           = require('lodash');
const filter_jpeg = require('nodeca.users/lib/filter_jpeg');


// Promise that waits for pica dependency to load
let waitForPica;

// Avatar upload finish callback
let onUploaded;

// Original image & it's sizes (sizes are calculated after orientation update)
let image, imageWidth, imageHeight;

// Avatar size config
const avatarWidth = '$$ N.config.users.avatars.resize.orig.width $$';
const avatarHeight = '$$ N.config.users.avatars.resize.orig.height $$';

const previewWidth = '$$ N.config.users.avatars.resize.md.width $$';
const previewHeight = '$$ N.config.users.avatars.resize.md.height $$';

// Cropped image box. Absolute coordinates,
// relative to not scaled original image (drawn in css-scaled canvas)
let cropperTop,
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
let data;

// Dialog elements
let $dialog, cropper, canvas, canvasPreview, canvasPreviewCtx;

// Timer to detect zoom and dialog size change
let sizeCheckInterval;


///////////////////////////////////////////////////////////////////////////////
// Redraw cropper frame

let redrawCropperStarted = false;

function _cropperUpdate() {
  cropper.style.top = (cropperTop * viewRatio + viewOffsetY) + 'px';
  cropper.style.left = (cropperLeft * viewRatio + viewOffsetX) + 'px';
  cropper.style.width = (cropperRight - cropperLeft) * viewRatio + 'px';
  cropper.style.height = (cropperBottom - cropperTop) * viewRatio + 'px';

  redrawCropperStarted = false;
}

var cropperUpdate = _.debounce(() => {
  if (!redrawCropperStarted) {
    redrawCropperStarted = true;
    window.requestAnimationFrame(_cropperUpdate);
  }
}, 10, { maxWait: 20 });


///////////////////////////////////////////////////////////////////////////////
// Redraw preview canvas

let redrawPreviewStarted = false;

// Used to discard previous result if HW resize called multiple times
let redrawTaskId = 0;

// Built high quality avatar preview. This is slow, do
// it only after user stopped cropper change
let previewHqUpdate = _.debounce(() => {
  const pica = require('pica');

  let width = cropperRight - cropperLeft;
  let height = cropperBottom - cropperTop;

  // Create offscreen cropped canvas
  let canvasCropped = document.createElement('canvas');

  canvasCropped.width  = width;
  canvasCropped.height = height;

  let ctxCropped = canvasCropped.getContext('2d');

  ctxCropped.drawImage(canvas,
    cropperLeft, cropperTop, width, height,
    0, 0, width, height);

  // Resize to preview size
  redrawTaskId = pica.resizeCanvas(canvasCropped, canvasPreview, {
    unsharpAmount: 80,
    unsharpRadius: 0.6,
    unsharpThreshold: 2
  }, () => {});

}, 500);


let previewUpdate = _.debounce(() => {
  const pica = require('pica');

  if (redrawPreviewStarted) return;

  redrawPreviewStarted = true;

  window.requestAnimationFrame(() => {
    // Build quick but rude preview first
    canvasPreviewCtx.drawImage(canvas,
      cropperLeft, cropperTop, cropperRight - cropperLeft, cropperBottom - cropperTop,
      0, 0, previewWidth, previewHeight);

    // Check is web worker available in browser
    if (pica.WW) {
      pica.terminate(redrawTaskId);
      previewHqUpdate();
    }

    redrawPreviewStarted = false;
  });
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
  let left, top;

  let width = cropperRight - cropperLeft;
  let height = cropperBottom - cropperTop;

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
  let ratio = avatarWidth / avatarHeight;

  let left, top, right, bottom;
  let refX, refY;
  let maxLeft, maxRight, maxTop, maxBottom, minLeft, minRight, minTop, minBottom, widthHalf, heightHalf;

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
function orientationApply(ctx, orientation) {
  let width = canvas.width;
  let height = canvas.height;

  if (!orientation || orientation > 8) return;

  if (orientation > 4) {
    ctx.canvas.width = height;
    ctx.canvas.height = width;
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

  image.onerror = () => { N.wire.emit('notify', t('err_image_invalid')); };

  image.onload =  () => {

    if (image.width < avatarWidth || image.height < avatarHeight) {
      N.wire.emit('notify', t('err_invalid_size', { w: avatarWidth, h: avatarHeight }));
      return;
    }

    canvas.width  = image.width;
    canvas.height = image.height;

    orientationApply(ctx, orientation);

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

  let reader = new FileReader();

  reader.onloadend = e => {
    // only keep comments and exif in header
    let filter = filter_jpeg({
      onIFDEntry: function readOrientation(ifd, entry) {
        if (ifd === 0 && entry.tag === 0x112 && entry.type === 3) {
          orientation = this.readUInt16(entry.value, 0);
        }
      }
    });

    try {
      filter.push(new Uint8Array(e.target.result));
      filter.end();
    } catch (err) {
      N.wire.emit('notify', t('err_image_invalid'));
      return;
    }

    image.src = window.URL.createObjectURL(file);
  };

  reader.readAsArrayBuffer(file);
}


// Init cropper
//
// - set handler to track touch/click point, when action started
// - track if mouse goes out of window
//
function initCropper() {
  let cropperClickOffsetX, cropperClickOffsetY, action;
  let $body = $('body');

  // Use `body` selector for listen mouse events outside of dialog
  $body
    .on('mouseup.nd.avatar_change touchend.nd.avatar_change', () => {
      $dialog.removeClass('avatar-dialog__m-cursor-' + action);
      $dialog.removeClass('avatar-dialog__m-crop-active');
      action = null;
    })
    .on('mousemove.nd.avatar_change touchmove.nd.avatar_change', event => {

      if (!action) return;

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

      let canvasRect = canvas.getBoundingClientRect();
      let point = event.originalEvent.touches ? event.originalEvent.touches[0] : event;
      let mouseX = (point.pageX - canvasRect.left) / viewRatio;
      let mouseY = (point.pageY - canvasRect.top) / viewRatio;

      if (action !== 'move') {
        cropperResize(mouseX, mouseY, action);
      } else {
        cropperDrag(cropperClickOffsetX, cropperClickOffsetY, mouseX, mouseY);
      }

      cropperUpdate();
      previewUpdate();
    });

  $(cropper).on('mousedown touchstart', event => {
    let $target = $(event.target);
    let point = event.originalEvent.touches ? event.originalEvent.touches[0] : event;

    let canvasRect = canvas.getBoundingClientRect();
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

  // Handles the event when user drag file to drag drop zone
  //
  N.wire.on('users.avatar.change:dd_area', function change_avatar_dd(data) {
    let x0, y0, x1, y1, ex, ey;
    let $dropZone = $('.avatar-change');

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

        if (data.files && data.files.length) {
          waitForPica
            .then(() => loadImage(data.files[0]))
            .catch(err => N.wire.emit('error', err));
        }
        break;

      default:
    }
  });


  ///////////////////////////////////////////////////////////////////////////////
  // Save selected avatar

  let formData;

  N.wire.on('users.avatar.change:apply', function change_avatar_resize(__, callback) {
    const pica = require('pica');

    var width = cropperRight - cropperLeft;
    var height = cropperBottom - cropperTop;

    // Create offscreen cropped canvas
    let canvasCropped = document.createElement('canvas');

    canvasCropped.width  = width;
    canvasCropped.height = height;

    let ctxCropped = canvasCropped.getContext('2d');

    ctxCropped.drawImage(canvas,
      cropperLeft, cropperTop, width, height,
      0, 0, width, height);


    // Create "final" avatar canvas
    var avatarCanvas = document.createElement('canvas');

    avatarCanvas.width = avatarWidth;
    avatarCanvas.height = avatarHeight;


    pica.resizeCanvas(canvasCropped, avatarCanvas, {
      unsharpAmount: 80,
      unsharpRadius: 0.6,
      unsharpThreshold: 2
    }, err => {

      if (err) {
        N.wire.emit('notify', t('err_image_invalid'));
        return;
      }

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
      .then(result => {
        data.avatar_id = result.avatar_id;
        $dialog.modal('hide');
        onUploaded();
      })
      .fail(() => {
        $dialog.modal('hide');
        N.wire.emit('notify', t('err_upload_failed'));
      })
      .always(() => { formData = null; });
  });


  // Page exit
  //
  N.wire.on('navigate.exit', function page_exit() {
    if (!$dialog) return;

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

  let lastWidth = $dialog.width();

  // We can't use `resize` event here because zoom level also change width, but doesn't fire `resize`
  sizeCheckInterval = setInterval(() => {
    let newWidth = $dialog.width();

    if (lastWidth === newWidth) return;

    lastWidth = newWidth;

    viewParamsUpdate();
    cropperUpdate();
  }, 500);

  $('#avatar-change__upload').on('change', function () {
    let files = $(this)[0].files;
    if (files.length > 0) {
      waitForPica
        .then(() => loadImage(files[0]))
        .catch(err => N.wire.emit('error', err));
    }
  });

  // Update cropper on dialog open.
  // Needed when we open dialog at second time with existing image
  $dialog.on('shown.bs.modal', function () {
    viewParamsUpdate();
    cropperUpdate();
  });

  $dialog.modal('show');

  waitForPica = new Promise((resolve, reject) => {
    N.loader.loadAssets('vendor.pica', function (err) {
      if (err) reject(err);
      else resolve(err);
    });
  });
});
