// File uploader with client side image resizing - used jQuery-File-Upload
//
// Ex.:
//
// Add files (from drop event)
//
// N.wire.emit('users.uploader:add', { files: event.dataTransfer.files, url: '/url/to/upload/method' });
// - files - required
// - url - required
//

'use strict';


var async = require('async');

var settings;
var $uploadDialog;
var aborted;


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
  N.io.rpc('users.uploader_config', {}, function (err, uploaderSettings) {
    if (err) {
      callback(err);
      return false;
    }
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

      N.wire.emit('users.uploader:startFile', { url: data.url, file: file }, function () {
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


// Check files extension and create unique id
//
N.wire.before('users.uploader:startFile', function check_file(data, callback) {
  data.uploaderFileId = 'file_' + Math.random().toString().split('.')[1]; // Create unique file id

  var allowedFileExt = new RegExp('\.(' + settings.allowed_extensions.join('|') + ')$', 'i');
  if (!allowedFileExt.test(data.file.name)) {
    var message = t('error_invalid_ext', { 'file_name': data.file.name });
    N.wire.emit('notify', { type: 'error', message: message });
    callback(new Error(message));
    return;
  }
  callback();
});


// Add initial progress info to dialog
//
N.wire.before('users.uploader:startFile', function add_file_progress(data, callback) {
  $(N.runtime.render(
    'users.uploader.progress',
    {
      fileName: data.file.name,
      elementId: data.uploaderFileId
    }
  )).appendTo('#users-uploader__files');

  callback();
});


// Resize image if needed
//
N.wire.before('users.uploader:startFile', function resize_file(data, callback) {
  if (aborted) {
    callback(new Error('aborted'));
    return;
  }

  // Check can we resize this file type
  var resizeTypeCheck = new RegExp('^' + settings.resize_types.join('|') + '$');
  if (!resizeTypeCheck.test(data.file.type)) {
    callback(); // Skip resize
    return;
  }

  var img = new Image();
  img.src = window.URL.createObjectURL(data.file);
  img.onload = function() {
    if (img.width <= settings.width || img.height <= settings.height) {
      callback();
      return;
    }
    var width = img.width * settings.height / img.height;
    var height = settings.height;
    var canvas = document.createElement('canvas');

    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    canvas.toBlob(function (blob) {
      blob.name = data.file.name;
      data.file = blob;
      callback();
    });
  };
});


// Start uploading
//
N.wire.on('users.uploader:startFile', function resize_file(data, callback) {
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

    N.wire.emit('notify', { type: 'error', message: t('upload_error', { file_name: data.file.name }) });
  })
  .always(callback);

  $uploadDialog.on('hidden.bs.modal', function () {
    jqXhr.abort();
  });
});
