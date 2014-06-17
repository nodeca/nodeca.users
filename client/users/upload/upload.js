// File uploader with client side image resizing - used jQuery-File-Upload

'use strict';


var $uploadDialog;
var $uploader;
var uploadHandler;


// Add files to uploader
//
// - files - array of File or Blob objects
//
N.wire.on('users.upload:add', function add_files(files) {
  if ($uploader) {
    $uploader.fileupload('add', {files: files});
    return;
  }
  throw new Error('You must init uploader first');
});


// Initialize uploader
//
// - params Object
//   - inputSelector - selector of input[type=file]
//   - uploadUrl - request url
//   - onDone - name of event, emit when uploads finish
//
N.wire.on('users.upload:init', function init_uploader(params) {
  N.io.rpc('users.upload_config', {}, function (err, settings) {
    if (err) { return false; }

    $uploadDialog = $('#users-upload__dialog');
    var $progressText = $('#users-upload__data');
    var $progress = $('#users-upload__progress');

    $uploadDialog
      .on('hidden.bs.modal', function () {
        // Abort query if user closes dialog
        if (uploadHandler) {
          uploadHandler.abort();
        }
      })
      .on('shown.bs.modal', function () {
        // Reset values
        $progress.width('0%');
        $progressText.text('0%');
      });

    $uploader = $(params.inputSelector).fileupload({
      formData: { csrf: N.runtime.csrf },
      sequentialUploads: true,
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
      add: function (e, data) {
        // Check files extensions
        var hasUnsupportedFiles = false;
        var allowedFileExt = new RegExp('(.)(' + settings.allowed_extensions.join('|') + ')$', 'i');
        data.files.forEach(function (file) {
          if (!allowedFileExt.test(file.name)) {
            N.wire.emit('notify', { type: 'error', message: t('unsupported_error', { 'file_name': file.name }) });
            hasUnsupportedFiles = true;
          }
        });
        // Has unsupported files - stop uploading
        if (hasUnsupportedFiles) {
          return;
        }

        // Show progress dialog
        $uploadDialog.modal('show');

        var $this = $(this);
        data.process(function () {
          return $this.fileupload('process', data);
        }).done(function () {
          // Run query
          uploadHandler = data.submit();
        });
      },
      progressall: function (e, data) {
        // Progress for all files
        var progress = parseInt(data.loaded / data.total * 100, 10) + '%';
        $progress.width(progress);
        $progressText.text(progress);
      },
      stop: function () {
        $uploadDialog.modal('hide');
        // Reload medias
        N.wire.emit(params.onDone);
      },
      fail: function (e, data) {
        // User abort
        if (data.errorThrown === 'abort') {
          return;
        }

        $uploadDialog.modal('hide');
        N.wire.emit('notify', { type: 'error', message: t('upload_error') });
      }
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
