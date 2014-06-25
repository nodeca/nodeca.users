// File uploader with client side image resizing - used jQuery-File-Upload
//
// Ex.:
//
// Initialize
//
// N.wire.emit('users.uploader:init', {
//   inputSelector: '#upload',
//   uploadUrl: /url/to/upload/method,
//   onDone: 'users.album:uploaded'
// });
//
// Add files (from drop event)
//
// N.wire.emit('users.uploader:add', { files: event.dataTransfer.files, url: '/url/to/upload/method' });
// - files - required
// - url - optional
//

'use strict';

var $uploadDialog;
var $uploader;
var settings;
var onDoneEvent;


// Will rise when one file fail
//
var onFileFail = function (event, data) {
  // User abort
  if (data.errorThrown === 'abort') {
    return;
  }

  var $progressInfo = $('#file_' + data.uploaderFileId);
  $progressInfo.addClass('fail');
  $progressInfo.find('.progress').removeClass('active');
  $progressInfo.find('.progress-bar').addClass('progress-bar-danger');

  N.wire.emit('notify', { type: 'error', message: t('upload_error', { file_name: data.files[0].name }) });
};


var onProgress = function (event, data) {
  var progress = parseInt(data.loaded / data.total * 100, 10) + '%';
  $('#file_' + data.uploaderFileId + ' .progress-bar').width(progress);
};


// Will rise when one file done
//
var onFileDone = function (event, data) {
  var $progressInfo = $('#file_' + data.uploaderFileId);
  $progressInfo.addClass('done');
  $progressInfo.find('.progress').removeClass('active');
  $progressInfo.find('.progress-bar').addClass('progress-bar-success');
};


// Will rise when all files will be done or fail
//
var onStop = function () {
  if ($uploadDialog) {
    $uploadDialog.modal('hide');
  }
  // Reload medias
  N.wire.emit(onDoneEvent);
};


// Add files to uploader
//
// - files - array of File or Blob objects
//
N.wire.on('users.uploader:add', function add_files(data) {
  if ($uploader) {
    if (data.url) {
      $uploader.fileupload('option', { url: data.url });
    }
    $uploader.fileupload('add', {files: data.files});
    return;
  }
  throw new Error('You must init uploader first');
});


// Fetch uploader settings
// TODO: get settings through 'init' event (on server through internal method)
//
N.wire.before('users.uploader:init', function fetch_settings(params, callback) {
  N.io.rpc('users.uploader_config', {}, function (err, uploaderSettings) {
    if (err) {
      callback(err);
      return false;
    }
    settings = uploaderSettings;
    callback();
  });
});


// Initialize uploader
//
// - params Object
//   - inputSelector - selector of input[type=file]
//   - uploadUrl - request url
//   - onDone - name of event, emit when uploads finish
//
N.wire.on('users.uploader:init', function init_uploader(params) {
  onDoneEvent = params.onDone;

  $uploader = $(params.inputSelector).fileupload({
    formData: { csrf: N.runtime.csrf },
    sequentialUploads: true,
    singleFileUploads: true,
    url: params.uploadUrl,
    dataType: 'json',
    dropZone: null,
    maxFileSize: settings.max_size_kb * 1024, // Need size in bytes
    add: function (e, data) { N.wire.emit('users.uploader:startFile', data); },
    progress: onProgress,
    stop: onStop,
    fail: onFileFail,
    done: onFileDone
  });
});


// Close dialog on sudden page exit (if user click back button in browser)
//
N.wire.on('navigate.exit', function teardown_page() {
  if ($uploadDialog) {
    $uploadDialog.modal('hide');
  }
});


// Validate file and create unique id
//
N.wire.before('users.uploader:startFile', function check_file(data, callback) {
  // data.files array always contains only one item
  var file = data.files[0];
  data.uploaderFileId = Math.random().toString().split('.')[1]; // Create unique file id

  // Check files extensions
  var allowedFileExt = new RegExp('\.(' + settings.allowed_extensions.join('|') + ')$', 'i');
  if (!allowedFileExt.test(file.name)) {
    var message = t('error_invalid_ext', { 'file_name': file.name });
    N.wire.emit('notify', { type: 'error', message: message });
    callback(new Error(message));
    return;
  }
  callback();
});


// Init uploader dialog if it is not exists
//
N.wire.before('users.uploader:startFile', function init_uploader_dialog(data, callback) {
  if (!$uploadDialog) {
    $uploadDialog = $(N.runtime.render('users.uploader'));
    $('body').append($uploadDialog);
    $uploadDialog
      .on('shown.bs.modal', function () {
        callback();
      })
      .on('hidden.bs.modal', function () {
        $uploadDialog.remove();
        $uploadDialog = null;
      })
      .modal('show');
    return;
  }
  callback();
});


// Add initial progress info to dialog
//
N.wire.before('users.uploader:startFile', function add_file_progress(data, callback) {
  var file = data.files[0];
  $(N.runtime.render(
    'users.uploader.progress',
    {
      fileName: file.name,
      elementId: 'file_' + data.uploaderFileId
    }
  )).appendTo('#users-uploader__files');

  callback();
});


// Resize image if needed
//
N.wire.before('users.uploader:startFile', function resize_file(data, callback) {
  var file = data.files[0];

  // Check type
  var resizeTypeCheck = new RegExp('^' + settings.resize_types.join('|') + '$');
  if (!resizeTypeCheck.test(file.type)) {
    callback(); // Skip resize
    return;
  }

  // 'window.loadImage' defined in 'JavaScript Load Image' plugin
  // https://github.com/blueimp/JavaScript-Load-Image
  window.loadImage(file, function (canvas) {
    canvas.toBlob(function (blob) {
      blob.name = data.files[0].name;
      data.files[0] = blob;
      callback();
    });
  }, {
    maxWidth: settings.width,
    maxHeight: settings.height,
    crop: false,
    canvas: true
  });
});


// Start uploading
//
N.wire.on('users.uploader:startFile', function resize_file(data, callback) {
  var handler = data.submit();
  $uploadDialog.on('hidden.bs.modal', function () {
    handler.abort();
  });
  callback();
});
