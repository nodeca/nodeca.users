// File uploader with client side image resizing - used jQuery-File-Upload

'use strict';


var $uploadDialog;
var uploadHandler;


N.wire.on('users.media.upload:dragenter', function () {
  $('#media-upload').addClass('media-upload__active');
});


N.wire.on('users.media.upload:dragleave', function () {
  $('#media-upload').removeClass('media-upload__active');
});


N.wire.on('users.media.upload:drop', function () {
  $('#media-upload').removeClass('media-upload__active');
  if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) {
    $('#media-upload__files').fileupload('add', {files: event.dataTransfer.files});
  }
});


N.wire.on('users.media.upload:init', function init_uploader(data) {
  var settings = N.runtime.page_data.uploader_settings;

  $uploadDialog = $('#media-upload__dialog');
  var $progressText = $('#media-upload__data');
  var $progress = $('#media-upload__progress');

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

  $('#media-upload__files').fileupload({
    url: N.runtime.router.linkTo('users.media.upload', data.params),
    dataType: 'json',
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
      $('#media-upload').removeClass('media-upload__active');
      // Reload medias
      N.wire.emit('users.media.upload:done');
    },
    fail: function (e, data) {
      $('#media-upload').removeClass('media-upload__active');
      
      // User abort
      if (data.errorThrown === 'abort') {
        return;
      }

      $uploadDialog.modal('hide');
      N.wire.emit('notify', { type: 'error', message: t('upload_error') });
    }
  });
});


// Close dialog on sudden page exit (if user click back button in browser)
//
N.wire.on('navigate.exit', function teardown_page() {
  if ($uploadDialog) {
    $uploadDialog.modal('hide');
  }
});
