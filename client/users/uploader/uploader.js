// File uploader with client side image resizing - used jQuery-File-Upload
//
// Ex.:
//
// Add files (from drop event)
//
// N.wire.emit('users.uploader:add', { files: event.dataTransfer.files, url: '/url/to/upload/method' });
// - files  - required
// - url    - required
// - config - required. name of server method that returns config for uploader
//

'use strict';


var async    = require('async');
var readExif = require('./_exif');

var settings;
var $uploadDialog;
var aborted;


// Check file extension. Create unique id. Add initial progress info to dialog
//
function checkFile(data) {
  data.uploaderFileId = 'file_' + Math.random().toString().split('.')[1]; // create unique file id

  var allowedFileExt = new RegExp('\.(' + settings.extentions.join('|') + ')$', 'i');
  if (!allowedFileExt.test(data.file.name)) {
    var message = t('err_invalid_ext', { 'file_name': data.file.name });
    N.wire.emit('notify', { type: 'error', message: message });
    return new Error(message);
  }

  $(N.runtime.render(
    'users.uploader.progress',
    {
      file_name: data.file.name,
      element_id: data.uploaderFileId
    }
  )).appendTo('#users-uploader__files');
}


// Rotate canvas to orientation
//
function updateOrientation(canvas, ctx, orientation) {

  var width = canvas.width;
  var height = canvas.height;

  if (orientation > 4) {
    canvas.width = height;
    canvas.height = width;
  }

  switch (orientation) {
    case 2:
      // horizontal flip
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      break;
    case 3:
      // 180° rotate left
      ctx.translate(width, height);
      ctx.rotate(Math.PI);
      break;
    case 4:
      // vertical flip
      ctx.translate(0, height);
      ctx.scale(1, -1);
      break;
    case 5:
      // vertical flip + 90 rotate right
      ctx.rotate(0.5 * Math.PI);
      ctx.scale(1, -1);
      break;
    case 6:
      // 90° rotate right
      ctx.rotate(0.5 * Math.PI);
      ctx.translate(0, -height);
      break;
    case 7:
      // horizontal flip + 90 rotate right
      ctx.rotate(0.5 * Math.PI);
      ctx.translate(width, -height);
      ctx.scale(-1, 1);
      break;
    case 8:
      // 90° rotate left
      ctx.rotate(-0.5 * Math.PI);
      ctx.translate(-width, 0);
      break;
    default:
      // case 1 - no need to change anything
  }
}


// Resize image if needed
//
function resizeImage(data, callback) {
  var ext = data.file.name.split('.').pop();
  var typeConfig = settings.types[ext] || {};

  // Check if file can be resized before upload
  if ([ 'bmp', 'jpg', 'jpeg', 'png' ].indexOf(ext) === -1 || !typeConfig.resize || !typeConfig.resize.orig) {
    callback(); // Skip resize
    return;
  }

  var resizeConfig = typeConfig.resize.orig;

  // If image size smaller than 'skip_size' - skip resizing
  if (data.file.size < resizeConfig.skip_size) {
    callback();
    return;
  }

  var orientation;
  var img = new Image();
  img.onload = function() {
    // To scale image we calculate new width and height, resize image by height and crop by width
    var scaledHeight, scaledWidth;

    if (resizeConfig.height && !resizeConfig.width) {
      // If only height defined - scale to fit height,
      // and crop by max_width
      scaledHeight = resizeConfig.height;
      var proportionalWidth = Math.floor(img.width * scaledHeight / img.height);
      scaledWidth = (!resizeConfig.max_width || resizeConfig.max_width > proportionalWidth) ?
                    proportionalWidth :
                    resizeConfig.max_width;

    } else if (!resizeConfig.height && resizeConfig.width) {
      // If only width defined - scale to fit width,
      // and crop by max_height
      scaledWidth = resizeConfig.width;
      var proportionalHeight = Math.floor(img.height * scaledWidth / img.width);
      scaledHeight = (!resizeConfig.max_height || resizeConfig.max_height > proportionalHeight) ?
                     proportionalHeight :
                     resizeConfig.max_height;

    } else {
      // If determine both width and height
      scaledWidth = resizeConfig.width;
      scaledHeight = resizeConfig.height;
    }

    var canvas = document.createElement('canvas');
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
    var ctx = canvas.getContext('2d');
    var width = img.width * scaledHeight / img.height;
    var cropX = (scaledWidth - width) / 2;
    var quality = (ext === 'jpeg' || ext === 'jpg') ? resizeConfig.jpeg_quality : undefined;

    if (orientation) {
      updateOrientation(canvas, ctx, orientation);
    }

    ctx.drawImage(img, cropX, 0, width, scaledHeight);

    canvas.toBlob(function (blob) {
      blob.name = data.file.name;
      data.file = blob;
      callback();
    }, typeConfig.mime_type, quality);
  };

  readExif(data.file, function (tags) {
    if (tags) {
      orientation = tags.orientation;
    }

    img.src = window.URL.createObjectURL(data.file);
  });
}


function checkFileSize(data) {
  var ext = data.file.name.split('.').pop();
  var typeConfig = settings.types[ext] || {};
  var maxSize = typeConfig.max_size || settings.max_size;

  if (data.file.size > maxSize) {
    var message = t('err_max_size', { 'file_name': data.file.name, size: maxSize });
    N.wire.emit('notify', { type: 'error', message: message });
    return new Error(message);
  }
}


// Start uploading
//
function startUpload(data, callback) {
  // If 'resizeImage' finished after user closed dialog
  if (aborted) {
    callback(new Error('aborted'));
    return;
  }

  var formData = new FormData();
  formData.append('file', data.file);
  formData.append('csrf', N.runtime.csrf);

  var $progressInfo = $('#' + data.uploaderFileId);

  var jqXhr = $.ajax({
    url: data.url,
    type: 'POST',
    data: formData,
    dataType: 'json',
    processData: false,
    contentType: false,
    xhr: function() {
      var xhr = $.ajaxSettings.xhr();
      if (xhr.upload) {
        xhr.upload.addEventListener('progress', function (e) {
          if (e.lengthComputable) {
            var progress = Math.round((e.loaded * 100) / e.total);
            $progressInfo.find('.progress-bar').width(progress + '%');
          }
        }, false);
      }
      return xhr;
    }
  })
  .done(function () {
    $progressInfo.find('.users-uploader__file').addClass('text-success');
    $progressInfo.find('.progress-bar').addClass('progress-bar-success');
  })
  .fail(function (jqXHR, textStatus, errorThrown) {
    // Don't show error if user terminate file upload
    if (errorThrown === 'abort') {
      return;
    }

    $progressInfo.find('.users-uploader__file').addClass('text-danger');
    $progressInfo.find('.progress-bar').addClass('progress-bar-danger');

    N.wire.emit('notify', { type: 'error', message: t('err_upload', { file_name: data.file.name }) });
  })
  .always(callback);

  $uploadDialog.on('hidden.bs.modal', function () {
    jqXhr.abort();
  });
}


////////////////////////////////////////////////////////////////////////////////
// Add files to uploader
//
// - data Object
//   - url - upload url
//   - files - array of files (DOM File API)
// - callback - function when upload done
//

// Load configuration from server
N.wire.before('users.uploader:add', function load_config(data, callback) {
  N.io.rpc(data.config).done(function (uploaderSettings) {
    settings = uploaderSettings;
    callback();
  });
});


// Init upload dialog
N.wire.before('users.uploader:add', function init_upload_dialog(data, callback) {
  $uploadDialog = $(N.runtime.render('users.uploader'));
  $('body').append($uploadDialog);
  $uploadDialog
    .on('shown.bs.modal', function () {
      callback();
    })
    .on('hidden.bs.modal', function () {
      $uploadDialog.remove();
      $uploadDialog = null;
      aborted = true;
    })
    .modal('show');
});


// Resize files if needed, upload files
N.wire.on('users.uploader:add', function add_files(data, callback) {
  aborted = false;

  async.eachLimit(
    data.files,
    4, // max parallel files upload
    function (file, callback) {
      // Check if user termintae upload
      if (aborted) {
        callback(new Error('aborted'));
        return;
      }

      var uploadInfo = { url: data.url, file: file };
      async.series([
        function (next) { next(checkFile(uploadInfo)); },
        function (next) {
          async.nextTick(function () {
            resizeImage(uploadInfo, next);
          });
        },
        function (next) { next(checkFileSize(uploadInfo)); },
        async.apply(startUpload, uploadInfo)
      ], function () {
        callback();
      });
    },
    function () {
      if ($uploadDialog) {
        $uploadDialog.modal('hide');
      }

      callback();
    }
  );
});


////////////////////////////////////////////////////////////////////////////////


// Close dialog on sudden page exit (if user click back button in browser)
//
N.wire.on('navigate.exit', function teardown_page() {
  if ($uploadDialog) {
    $uploadDialog.modal('hide');
  }
});
