'use strict';

var readExif = require('../../uploader/_exif');

var $dialog;
var $selectArea;
var $selectResize;
var $original;
var $preview;
var minSize = 50; // TODO: calculate
var img;


function updatePreview() {
  var ctx = $preview[0].getContext('2d');
  $preview[0].width = 150;
  $preview[0].height = 150;

  var x = parseInt($selectArea.css('left'), 10);
  var y = parseInt($selectArea.css('top'), 10);

  var width = parseInt($selectArea.width(), 10);
  var height = parseInt($selectArea.height(), 10);

  var pX = $original.width() / img.width;
  var pY = $original.height() / img.height;

  var size = parseInt(width > height ? width / pX : height / pY, 10);

  ctx.drawImage(img, parseInt(x / pX, 10), parseInt(y / pY, 10), size, size, 0, 0, 150, 150);
}


// Init dialog on event
//
N.wire.on('users.member.change_avatar', function show_change_avatar() {
  $dialog = $(N.runtime.render('users.member.change_avatar'));
  $('body').append($dialog);

  // When dialog closes - remove it from body
  $dialog.on('hidden.bs.modal', function () {
    $dialog.remove();
    $dialog = null;
  });

  $dialog.modal('show');
  $selectArea = $('.change-avatar-image__select');
  $selectResize = $('.change-avatar-image__select-resize');
  $original = $('.change-avatar-image__canvas');
  $preview = $('.change-avatar-preview');

  var x, y, left, top, width, height, drag = false, resize = false;

  $selectArea
    .on('mousedown touchstart', function (event) {
      x = event.pageX;
      y = event.pageY;
      left = parseInt($selectArea.css('left'), 10);
      top = parseInt($selectArea.css('top'), 10);
      width = parseInt($selectArea.width(), 10);
      height = parseInt($selectArea.height(), 10);
      drag = true;
    });

  // TODO: remove event on dialog hide
  $('body').on('mouseup touchend', function () {
    resize = false;
    drag = false;
  }).on('mousemove touchmove', function (event) {
    if (!drag && !resize) {
      return;
    }

    var dX = event.pageX - x;
    var dY = event.pageY - y;

    if (resize) {
      var dS = dX > dY ? dY : dX;
      var newSize = width + dS;

      if (newSize < minSize) {
        newSize = minSize;
      }

      $selectArea.width(newSize).height(newSize);
    } else {
      var newLeft = left + dX;
      var newTop = top + dY;

      if (newLeft < 0) {
        newLeft = 0;
      }

      if (newTop < 0) {
        newTop = 0;
      }

      if (newLeft + width > $original.width()) {
        newLeft = $original.width() - width;
      }

      if (newTop + height > $original.height()) {
        newTop = $original.height() - height;
      }

      $selectArea.css('left', newLeft + 'px');
      $selectArea.css('top', newTop + 'px');
    }

    updatePreview();
  });

  $selectResize
    .on('mousedown touchstart', function (event) {
      x = event.pageX;
      y = event.pageY;
      left = parseInt($selectArea.css('left'), 10);
      top = parseInt($selectArea.css('top'), 10);
      width = parseInt($selectArea.width(), 10);
      height = parseInt($selectArea.height(), 10);
      resize = true;
      event.stopPropagation();
    });
});


N.wire.on('users.member.change_avatar:select_file', function select_file() {
  $('.change-avatar-upload__files').click();
});


function loadImage(file) {
  var ctx = $original[0].getContext('2d');

  img = new Image();
  img.onload = function() {
    $original[0].width = img.width;
    $original[0].height = img.height;

    var size = $original.width() > $original.height() ? $original.height() : $original.width();

    $selectArea.width(size).height(size);

    ctx.drawImage(img, 0, 0, img.width, img.height);
    $selectArea.removeClass('hidden');
    updatePreview();
  };

  readExif(file, function () {
    // TODO: orientation

    img.src = window.URL.createObjectURL(file);
  });
}


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
