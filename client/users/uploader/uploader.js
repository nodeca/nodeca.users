// File uploader with client side image resizing - used jQuery-File-Upload

'use strict';


var $uploadDialog;
var $uploader;
// XHR uploading handlers
var uploadHandlers;
var settings;
var onDone;
// To track uploading progress, increases for for each file
var lastFileId = 1;

// Add files to uploader
//
// - files - array of File or Blob objects
//
N.wire.on('users.uploader:add', function add_files(files) {
  if ($uploader) {
    $uploader.fileupload('add', {files: files});
    return;
  }
  throw new Error('You must init uploader first');
});


var onAddFile = function (event, data) {
  // onAddFile will be called for each file independently
  // data.files array always contains only one item
  var file = data.files[0];
  data.fileId = lastFileId++;

  // Check files extensions
  var allowedFileExt = new RegExp('(.)(' + settings.allowed_extensions.join('|') + ')$', 'i');
  if (!allowedFileExt.test(file.name)) {
    N.wire.emit('notify', { type: 'error', message: t('unsupported_error', { 'file_name': file.name }) });
    return;
  }

  $('<li/>')
    .appendTo('#users-uploader__files')
    .append('<div class="users-uploader__file">' + file.name + '</div>')
    .append('<div class="users-uploader__bar img-rounded"><div class="users-uploader__progress"></div></div>')
    .attr('id', 'file_' + data.fileId);

  // Show progress dialog
  var $this = $(this);
  $uploadDialog
    .on('shown.bs.modal.add_file', function () {
      data.process(function () {
        return $this.fileupload('process', data);
      }).done(function () {
        $uploadDialog.off('shown.bs.modal.add_file');
        // Run query
        uploadHandlers.push(data.submit());
      });
    })
    .modal('show');
};


var onProgress = function (event, data) {
  var progress = parseInt(data.loaded / data.total * 100, 10) + '%';
  $('#file_' + data.fileId + ' .users-uploader__progress').width(progress);
};


var onFail = function (event, data) {
  // User abort
  if (data.errorThrown === 'abort') {
    return;
  }

  N.wire.emit('notify', { type: 'error', message: t('upload_error') });
};


var onStop = function () {
  uploadHandlers = [];
  $('#users-uploader__files').empty();
  $uploadDialog.modal('hide');
  // Reload medias
  N.wire.emit(onDone);
};


// Initialize uploader
//
// - params Object
//   - inputSelector - selector of input[type=file]
//   - uploadUrl - request url
//   - onDone - name of event, emit when uploads finish
//
N.wire.on('users.uploader:init', function init_uploader(params) {
  N.io.rpc('users.uploader_config', {}, function (err, uploaderSettings) {
    if (err) { return false; }
    settings = uploaderSettings;
    onDone = params.onDone;

    $uploadDialog = $('#users-uploader__dialog');
    uploadHandlers = [];
    $('#users-uploader__files').empty();

    $uploadDialog.on('hidden.bs.modal', function () {
      // Abort query if user closes dialog
      $.each(uploadHandlers, function (index, handler) {
        handler.abort();
      });
    });

    $uploader = $(params.inputSelector).fileupload({
      formData: { csrf: N.runtime.csrf },
      sequentialUploads: true,
      singleFileUploads: true,
      url: params.uploadUrl,
      dataType: 'json',
      dropZone: null,
      maxFileSize: settings.max_size_kb * 1024, // Need size in bytes
      processQueue: [
        {
          action: 'loadImage',
          fileTypes: new RegExp('^' + settings.resize_types.join('|') + '$')
        },
        {
          action: 'resizeImage',
          maxWidth: settings.width,
          maxHeight: settings.height,
          imageCrop: false
        },
        {
          action: 'saveImage'
        }
      ],
      add: onAddFile,
      progress: onProgress,
      stop: onStop,
      fail: onFail
    });
  });
});


// Close dialog on sudden page exit (if user click back button in browser)
//
N.wire.on('navigate.exit', function teardown_page() {
  if ($uploadDialog) {
    $uploadDialog.modal('hide');
  }
});
