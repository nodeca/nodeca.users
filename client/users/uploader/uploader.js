// File uploader with client side image resizing - used jQuery-File-Upload
//
// Ex.:
//
// Add files (from drop event)
//
// N.wire.emit('users.uploader:add', { files: event.dataTransfer.files, url: '/url/to/upload/method' });
// - files    - required
// - url      - required
// - config   - required. name of server method that returns config for uploader
// - uploaded - null. will be filled after upload. array of uploaded media (media_id, type, file_name)
//

'use strict';


var async    = require('async');
var readExif = require('nodeca.users/lib/exif');
var pica     = require('pica');


var settings;
var $uploadDialog;
var aborted;
var uploadedFiles;


// Check file extension. Create unique id. Add initial progress info to dialog
//
function checkFile(data) {
  var allowedFileExt = new RegExp('\.(' + settings.extentions.join('|') + ')$', 'i');
  var message;

  data.uploaderFileId = 'upload_' + Math.floor(Math.random() * 1e10); // create unique file id

  if (!allowedFileExt.test(data.file.name)) {
    message = t('err_invalid_ext', { 'file_name': data.file.name });
    N.wire.emit('notify', message);
    return new Error(message);
  }

  $(N.runtime.render(
    'users.uploader.progress',
    {
      file_name: data.file.name,
      element_id: data.uploaderFileId
    }
  )).appendTo('#uploader-files');
}


// Resize image if needed
//
function resizeImage(data, callback) {
  var slice = data.file.slice || data.file.webkitSlice || data.file.mozSlice;
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

  var $progressStatus = $('#' + data.uploaderFileId).find('.uploader-progress__status');
  var jpegHeader;
  var img = new Image();

  $progressStatus
    .text(t('progress.compressing'))
    .show(0);

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

    var quality = (ext === 'jpeg' || ext === 'jpg') ? resizeConfig.jpeg_quality : undefined;

    var width = Math.min(img.height * scaledWidth / scaledHeight, img.width);
    var cropX = (width - img.width) / 2;

    var source = document.createElement('canvas');
    var dest = document.createElement('canvas');

    source.width = width;
    source.height = img.height;

    dest.width = scaledWidth;
    dest.height = scaledHeight;

    source.getContext('2d').drawImage(img, cropX, 0, width, img.height);

    pica.resizeCanvas(source, dest, { alpha: true }, function () {

      dest.toBlob(function (blob) {
        var jpegBlob, jpegBody;


        if (jpegHeader) {
          jpegBody = slice.call(blob, 20);

          jpegBlob = new Blob([ jpegHeader, jpegBody ], { type: data.file.type });
        }

        var name = data.file.name;

        data.file = jpegBlob || blob;
        data.file.name = name;

        $progressStatus.hide(0);
        callback();
      }, data.file.type, quality);
    });
  };

  var reader = new FileReader();

  reader.onloadend = function (e) {
    var exifData = readExif(new Uint8Array(e.target.result));

    if (exifData) {
      jpegHeader = exifData.header;
    }

    img.src = window.URL.createObjectURL(data.file);
  };

  var maxMetadataSize = Math.min(data.file.size, 256 * 1024);

  reader.readAsArrayBuffer(slice.call(data.file, 0, maxMetadataSize));
}


function checkFileSize(data) {
  var ext = data.file.name.split('.').pop();
  var typeConfig = settings.types[ext] || {};
  var maxSize = typeConfig.max_size || settings.max_size;
  var message;

  if (data.file.size > maxSize) {
    message = t('err_max_size', {
      'file_name': data.file.name,
      size: maxSize / (1024 * 1024)
    });
    N.wire.emit('notify', message);

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
      var progress;

      if (xhr.upload) {
        xhr.upload.addEventListener('progress', function (e) {
          if (e.lengthComputable) {
            progress = Math.round((e.loaded * 100) / e.total);
            $progressInfo.find('.progress-bar').width(progress + '%');
          }
        }, false);
      }
      return xhr;
    }
  })
  .done(function (res) {
    uploadedFiles.push(res.media);
    $progressInfo.find('.progress-bar').addClass('progress-bar-success');
  })
  .fail(function (jqXHR, textStatus, errorThrown) {
    // Don't show error if user terminate file upload
    if (errorThrown === 'abort') {
      return;
    }

    $progressInfo.find('.uploader-progress__name').addClass('text-danger');
    $progressInfo.find('.progress-bar').addClass('progress-bar-danger');

    // Client error
    if (jqXHR.status === N.io.CLIENT_ERROR) {
      N.wire.emit('notify', jqXHR.responseText);
    } else {
      N.wire.emit('notify', t('err_upload', { file_name: data.file.name }));
    }
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
      uploadedFiles = null;
      aborted = true;
    })
    .modal('show');
});


// Resize files if needed, upload files
N.wire.on('users.uploader:add', function add_files(data, callback) {
  aborted = false;
  uploadedFiles = [];

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

      if (!aborted) {
        data.uploaded = uploadedFiles;
        callback();
      }
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
