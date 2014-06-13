'use strict';


var $uploadDialog;
var uploadHandler;


N.wire.on('navigate.done', function init_uploader(data) {

  $uploadDialog = $('#media-upload__dialog');

  $uploadDialog.on('hidden.bs.modal', function () {
    if (uploadHandler) {
      uploadHandler.abort();
    }
  });

  var $progressText = $('#media-upload__data');
  var $progress = $('#media-upload__progress');

  // TODO: use config
  $('#media-upload__files').fileupload({
    dropZone: $('#media-upload'),
    url: N.runtime.router.linkTo('users.media.upload', data.params),
    dataType: 'json',
    imageMaxWidth: 1024,
    imageMaxHeight: 768,
    imageCrop: false,
    acceptFileTypes: /(\.|\/)(gif|jpe?g|png)$/i,
    maxFileSize: 5000000,
    add: function (e, data) {
      uploadHandler = data.submit();
      $progress.width('0%');
      $progressText.text('0%');
      $uploadDialog.modal('show');
    },
    progressall: function (e, data) {
      var progress = parseInt(data.loaded / data.total * 100, 10) + '%';
      $progress.width(progress);
      $progressText.text(progress);
    },
    done: function () {
      $uploadDialog.modal('hide');
      // TODO: reload page part
      window.location.reload();
    },
    fileuploadfail: function (e, data) {
      // TODO: error handling
      console.log(e);
      console.log(data);
    }
  });

});


// Close dialog on sudden page exit (if user click back button in browser)
//
N.wire.on('navigate.exit', function teardown_page() {
  if ($uploadDialog) {
    $uploadDialog.modal('hide');
  }

  if (uploadHandler) {
    uploadHandler.abort();
  }
});
