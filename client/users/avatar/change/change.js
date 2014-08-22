// Change avatar dialog
//

'use strict';


var _        = require('lodash');
var raf      = require('raf');


var readExif = require('nodeca.users/lib/exif');


// Avatar upload finish callback
var onUploaded;

// Original image
var image,
  imageWidth,
 imageHeight;

// Avatar size config
var avatarWidth = '$$ N.config.users.avatars.resize.orig.width $$';
var avatarHeight = '$$ N.config.users.avatars.resize.orig.height $$';

var previewWidth = '$$ N.config.users.avatars.resize.md.width $$';
var previewHeight = '$$ N.config.users.avatars.resize.md.height $$';

// Cropped image position
var cropperTop,
  cropperRight,
  cropperBottom,
  cropperLeft,
  viewOffsetX, // Canvas offset from parent element
  viewOffsetY,
  viewRatio; // The ratio of displayable image width to real image width

// Dialog data (data.avatar_id will be filled after upload)
var data;

// Dialog elements
var $dialog, $selectArea, $canvas, $canvasPreview, canvasPreviewCtx;


///////////////////////////////////////////////////////////////////////////////
// Redraw cropper frame

var redrawCropperStarted = false;

function _cropperUpdate () {
  $selectArea.css({
    top: (cropperTop * viewRatio + viewOffsetY) + 'px',
    left: (cropperLeft * viewRatio + viewOffsetX) + 'px',
    width: (cropperRight - cropperLeft) * viewRatio + 'px',
    height: (cropperBottom - cropperTop) * viewRatio + 'px'
  });

  redrawCropperStarted = false;
}

var cropperUpdate = _.debounce(function () {
  if (!redrawCropperStarted) {
    redrawCropperStarted = true;
    raf(_cropperUpdate);
  }
}, 10, { maxWait: 20 });


///////////////////////////////////////////////////////////////////////////////
// Redraw preview canvas

var redrawPreviewStarted = false;

function _previewUpdate() {
  canvasPreviewCtx.drawImage(
    $canvas[0],
    cropperLeft,
    cropperTop,
    cropperRight - cropperLeft,
    cropperBottom - cropperTop,
    0,
    0,
    previewWidth,
    previewHeight
  );

  redrawPreviewStarted = false;
}

var previewUpdate = _.debounce(function () {
  if (!redrawPreviewStarted) {
    redrawPreviewStarted = true;
    raf(_previewUpdate);
  }
}, 50, { maxWait: 70 });

///////////////////////////////////////////////////////////////////////////////


// Set `number` in range (`min`, `max`)
//
function clamp(number, min, max) {
  return Math.max(min, Math.min(number, max));
}


// Event handler for moving selected area
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


// Event handler for resizing selected area
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
      minBottom = refY + avatarHeight;
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
      maxTop = refY - avatarHeight;
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
      maxLeft = refX - avatarWidth;
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
      minRight = refX + avatarWidth;
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
      minRight = refX + avatarWidth;
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
      maxLeft = refX - avatarWidth;
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
      maxTop = refY - avatarHeight;
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
      minBottom = refY + avatarHeight;
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


// Apply JPEG orientation to canvas
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


// Update viewRatio, viewOffsetX, viewOffsetY on image load or on window resize
//
function viewParamsUpdate() {
  var viewPosition = $canvas.position();

  viewOffsetX = viewPosition.left + parseFloat($canvas.css('marginLeft'));
  viewOffsetY = viewPosition.top + parseFloat($canvas.css('marginTop'));

  viewRatio = $canvas.width() / $canvas[0].width;

  imageWidth = $canvas[0].width;
  imageHeight = $canvas[0].height;
}


// Load image from user's file
//
function loadImage(file) {
  var ctx = $canvas[0].getContext('2d');
  var orientation;

  image = new Image();
  image.onload = function () {

    if (image.width < avatarWidth || image.height < avatarHeight) {
      N.wire.emit('notify', t('err_invalid_size', { w: avatarWidth, h: avatarHeight }));
      return;
    }

    $canvas[0].width = image.width;
    $canvas[0].height = image.height;

    orientationApply($canvas[0], ctx, orientation);

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


  var reader = new FileReader();

  reader.onloadend = function (e) {
    var exifData = readExif(new Uint8Array(e.target.result));

    if (exifData && exifData.orientation) {
      orientation = exifData.orientation;
    }

    image.src = window.URL.createObjectURL(file);
  };

  reader.readAsArrayBuffer(file);
}


// Init select area (bind to mouse events)
//
function initSelectArea() {
  var cropperClickOffsetX, cropperClickOffsetY, action;
  var $body = $('body');

  // Use `body` selector for listen mouse events outside of dialog
  $body
    .on('mouseup.change_avatar touchend.change_avatar', function () {
      $dialog.removeClass('avatar-dialog__m-cursor-' + action);
      action = null;
    })
    .on('mousemove.change_avatar touchmove.change_avatar', function (event) {

      if (!action) {
        return;
      }

      // Detect mouse button up for case when `mouseup` event happens
      // out of browser window. Check current state directly. Skip this check
      // for touch events, because they have invalid mouse buttons values.
      // `event.which` works in chrome, `event.buttons` in firefox
      if (event.type === 'mousemove' && (event.which === 0 || event.buttons === 0)) {
        $dialog.removeClass('avatar-dialog__m-cursor-' + action);
        action = null;
        return;
      }

      var absoluteOffset = $canvas.offset();
      var point = event.originalEvent.touches ? event.originalEvent.touches[0] : event;
      var mouseX = (point.pageX - absoluteOffset.left) / viewRatio;
      var mouseY = (point.pageY - absoluteOffset.top) / viewRatio;

      if (action !== 'move') {
        cropperResize(mouseX, mouseY, action);
      } else {
        cropperDrag(cropperClickOffsetX, cropperClickOffsetY, mouseX, mouseY);
      }

      cropperUpdate();
      previewUpdate();
    });

  $selectArea.on('mousedown touchstart', function (event) {
    var $target = $(event.target);
    var point = event.originalEvent.touches ? event.originalEvent.touches[0] : event;

    var absoluteOffset = $canvas.offset();
    cropperClickOffsetX = (point.pageX - absoluteOffset.left) / viewRatio - cropperLeft;
    cropperClickOffsetY = (point.pageY - absoluteOffset.top) / viewRatio - cropperTop;

    if (!action) {
      action = $target.data('action');
      $dialog.addClass('avatar-dialog__m-cursor-' + action);
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
  N.wire.on('users.avatar.change:dd_area', function change_avatar_dd(event) {
    var x0, y0, x1, y1, ex, ey;
    var $dropZone = $('.avatar-change');

    switch (event.type) {
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
        ex = event.originalEvent.pageX;
        ey = event.originalEvent.pageY;

        if (ex > x1 || ex < x0 || ey > y1 || ey < y0) {
          $dropZone.removeClass('active');
        }
        break;
      case 'drop':
        $dropZone.removeClass('active');

        if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) {
          loadImage(event.dataTransfer.files[0]);
        }
        break;
      default:
    }
  });


  // Save selected avatar
  //
  N.wire.on('users.avatar.change:apply', function change_avatar_apply() {

    var canvas = document.createElement('canvas');

    canvas.width = (cropperRight - cropperLeft);
    canvas.height = (cropperBottom - cropperTop);

    var ctx = canvas.getContext('2d');

    ctx.drawImage($canvas[0], cropperLeft, cropperTop, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(function (blob) {
      var formData = new FormData();
      formData.append('file', blob);
      formData.append('csrf', N.runtime.csrf);

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
        });

    }, 'image/jpeg', 90);
  });
});


// Init dialog on event
//
N.wire.on('users.avatar.change', function show_change_avatar(params, callback) {
  data = params;
  onUploaded = callback;

  $dialog = $(N.runtime.render('users.avatar.change'));
  $('body').append($dialog);

  $(window).on('resize.change_avatar', function () {
    viewParamsUpdate();
    cropperUpdate();
  });

  // When dialog closes - remove it from body
  $dialog.on('hidden.bs.modal', function () {
    $dialog.remove();
    $dialog = null;

    $('body').off('mouseup.change_avatar touchend.change_avatar mousemove.change_avatar touchmove.change_avatar');
    $(window).off('resize.change_avatar');
    onUploaded = null;
    image = null;
    viewRatio = null;
  });

  $dialog.modal('show');
  $selectArea = $('.avatar-cropper');
  $canvas = $('.avatar-change__canvas');
  $canvasPreview = $('.avatar-change-preview');
  canvasPreviewCtx = $canvasPreview[0].getContext('2d');
  $canvasPreview[0].width = previewWidth;
  $canvasPreview[0].height = previewHeight;

  initSelectArea();

  $('.avatar-change__upload').on('change', function () {
    var files = $(this).get(0).files;
    if (files.length > 0) {
      loadImage(files[0]);
    }
  });
});
