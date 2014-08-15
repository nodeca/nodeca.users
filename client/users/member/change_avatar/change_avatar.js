'use strict';

//var readExif = require('../../uploader/_exif');

// Avatar upload finish callback
var onUploaded;

// Original image
var image;

// Avatar size config
var avatarConfig;

// The ratio of displayable image width to real image width
var scale;

var $dialog;
var $selectArea;
var $canvas;
var $canvasPreview;

// Update select area position
//
function updateSelectArea() {
  var sizeX, sizeY, left, top;
  scale = $canvas.width() / image.width;

  left = top = 0;
  sizeX = sizeY = Math.min($canvas.height(), $canvas.width());

  $selectArea.css({
    top: top + 'px',
    left: left + 'px',
    width: sizeX + 'px',
    height: sizeY + 'px'
  });
}


// Update preview canvas (crop by selected area)
//
function updatePreview() {
  var ctx = $canvasPreview[0].getContext('2d');
  $canvasPreview[0].width = 150;
  $canvasPreview[0].height = 150;

  var x = parseInt($selectArea.css('left'), 10);
  var y = parseInt($selectArea.css('top'), 10);

  var width = parseInt($selectArea.width(), 10);
  var height = parseInt($selectArea.height(), 10);

  var size = parseInt(width > height ? width / scale : height / scale, 10);

  ctx.drawImage(image, parseInt(x / scale, 10), parseInt(y / scale, 10), size, size, 0, 0, 150, 150);
}


// Event handler for moving selected area
//
function dragSelectArea(left, top, width, height, dX, dY) {
  var origWidth = parseInt($canvas.width(), 10);
  var origHeight = parseInt($canvas.height(), 10);
  var newLeft = left + dX;
  var newTop = top + dY;

  if (newLeft < 0) {
    newLeft = 0;
  }

  if (newTop < 0) {
    newTop = 0;
  }

  if (newLeft + width > origWidth) {
    newLeft = origWidth - width;
  }

  if (newTop + height > origHeight) {
    newTop = origHeight - height;
  }

  $selectArea.css('left', newLeft + 'px');
  $selectArea.css('top', newTop + 'px');
}


// Event handler for resizing selected area
//
function resizeSelectArea(left, top, width, height, dX, dY, dir) {
  var newLeft, newTop, newWidth, newHeight, dS;

  var origWidth = parseInt($canvas.width(), 10);
  var origHeight = parseInt($canvas.height(), 10);

  var resizeConfig = avatarConfig.types[avatarConfig.extentions[0]].resize.orig;
  var avatarWidth = resizeConfig.width || resizeConfig.max_width;
  var avatarHeight = resizeConfig.height || resizeConfig.max_height;
  var minSizeW = avatarWidth * scale;
  var minSizeH = avatarHeight * scale;

  switch (dir) {
    case 'se':
      dS = Math.min(dX, dY);

      newLeft = left;
      newTop = top;
      newHeight = newWidth = width + dS;

      if (newWidth < minSizeW) {
        newWidth = minSizeW;
      }

      if (newHeight < minSizeH) {
        newHeight = minSizeH;
      }

      if (newLeft + newWidth > origWidth || newTop + newHeight > origHeight) {
        newHeight = newWidth = Math.min(origWidth - newLeft, origHeight - newTop);
      }

      break;


    // TODO: implement other cases
    default:
      return;
  }

  $selectArea.css({
    top: newTop + 'px',
    left: newLeft + 'px',
    width: newWidth + 'px',
    height: newHeight + 'px'
  });
}


// Init select area (bind to mouse events)
//
function initSelectArea() {
  var border = 10;
  var x, y, left, top, width, height, started = false, dir;

  $('body')
    .on('mouseup.change_avatar touchend.change_avatar', function () {
      started = false;
    })
    .on('mousemove.change_avatar touchmove.change_avatar', function (event) {
      if (!started) {

        var offset = $selectArea.offset();
        var x0 = offset.left;
        var x1 = offset.left + parseInt($selectArea.width(), 10);
        var y0 = offset.top;
        var y1 = offset.top + parseInt($selectArea.height(), 10);

        var isIn = event.pageX >= x0 && event.pageX <= x1 && event.pageY >= y0 && event.pageY <= y1;

        var leftBorder = event.pageX >= x0 && event.pageX < x0 + border;
        var rightBorder = event.pageX <= x1 && event.pageX > x1 - border;
        var topBorder = event.pageY >= y0 && event.pageY < y0 + border;
        var bottomBorder = event.pageY <= y1 && event.pageY > y1 - border;

        if (isIn) {
          dir = topBorder ? 'n' : bottomBorder ? 's' : '';
          dir += leftBorder ? 'w' : rightBorder ? 'e' : '';
        } else {
          dir = '';
        }

        if (dir !== '') {
          $selectArea.css('cursor', dir + '-resize');
        } else {
          $selectArea.css('cursor', 'move');
        }

        return;
      }

      var dX = event.pageX - x;
      var dY = event.pageY - y;

      if (dir !== '') {
        resizeSelectArea(left, top, width, height, dX, dY, dir);
      } else {
        dragSelectArea(left, top, width, height, dX, dY);
      }

      updatePreview();
    });

  $selectArea.on('mousedown touchstart', function (event) {
    x = event.pageX;
    y = event.pageY;
    left = parseInt($selectArea.css('left'), 10);
    top = parseInt($selectArea.css('top'), 10);
    width = parseInt($selectArea.width(), 10);
    height = parseInt($selectArea.height(), 10);

    started = true;
  });
}


// Load image from user's file
//
function loadImage(file) {
  var ctx = $canvas[0].getContext('2d');

  image = new Image();
  image.onload = function () {

    var resizeConfig = avatarConfig.types[avatarConfig.extentions[0]].resize.orig;
    var avatarWidth = resizeConfig.width || resizeConfig.max_width;
    var avatarHeight = resizeConfig.height || resizeConfig.max_height;

    if (image.width < avatarWidth || image.height < avatarHeight) {
      N.wire.emit('notify', t('err_invalid_size', { 'file_name': file.name }));
    }

    $canvas[0].width = image.width;
    $canvas[0].height = image.height;

    ctx.drawImage(image, 0, 0, image.width, image.height);
    $selectArea.removeClass('hidden');

    updateSelectArea();
    updatePreview();
  };


  var reader = new FileReader();

  reader.onloadend = function () {
    //var exifData = readExif(new Uint8Array(e.target.result));

    // TODO: orientation

    image.src = window.URL.createObjectURL(file);
  };

  reader.readAsArrayBuffer(file);
}


// Get avatar size config
//
N.wire.before('users.member.change_avatar', function load_config(data, callback) {
  if (avatarConfig) {
    callback();
    return;
  }

  N.io.rpc('users.member.avatar.config').done(function (data) {
    avatarConfig = data.size_config;
    callback();
  });
});


// Init dialog on event
//
N.wire.on('users.member.change_avatar', function show_change_avatar(__, callback) {
  onUploaded = callback;

  $dialog = $(N.runtime.render('users.member.change_avatar'));
  $('body').append($dialog);

  $(window).on('resize.change_avatar', function () {
    updateSelectArea();
    updatePreview();
  });
  // When dialog closes - remove it from body
  $dialog.on('hidden.bs.modal', function () {
    $dialog.remove();
    $dialog = null;

    $('body').off('mouseup.change_avatar touchend.change_avatar mousemove.change_avatar touchmove.change_avatar');
    $(window).off('resize.change_avatar');
    onUploaded = null;
  });

  $dialog.modal('show');
  $selectArea = $('.change-avatar-image__select');
  $canvas = $('.change-avatar-image__canvas');
  $canvasPreview = $('.change-avatar-preview');

  initSelectArea();

  $('.change-avatar-upload__files').on('change', function () {
    var files = $(this).get(0).files;
    if (files.length > 0) {
      loadImage(files[0]);
    }
  });
});


// Show system dialog file selection
//
N.wire.on('users.member.change_avatar:select_file', function select_file() {
  $('.change-avatar-upload__files').click();
});


// Handles the event when user drag file to drag drop zone
//
N.wire.on('users.member.change_avatar:dd_area', function change_avatar_dd(event) {
  var x0, y0, x1, y1, ex, ey;
  var $dropZone = $('.change-avatar-upload');

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
N.wire.on('users.member.change_avatar:apply', function change_avatar_apply() {
  $canvasPreview[0].toBlob(function (blob) {
    var formData = new FormData();
    formData.append('file', blob);
    formData.append('csrf', N.runtime.csrf);

    $.ajax({
      url: N.router.linkTo('users.member.avatar.upload'),
      type: 'POST',
      data: formData,
      dataType: 'json',
      processData: false,
      contentType: false
    })
      .done(function () {
        $dialog.modal('hide');
        onUploaded();
      })
      .fail(function () {
        $dialog.modal('hide');
        N.wire.emit('notify', t('err_upload_failed'));
      });
  }, 'image/jpeg', 100);
});
