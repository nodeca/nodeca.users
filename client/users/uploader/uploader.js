// File uploader with client side image resizing - used jQuery-File-Upload
//
// Ex.:
//
// Add files (from drop event)
//
// let params = {
//   files: event.dataTransfer.files,
//   rpc: [ apiPath, params ],
//   config: 'users.uploader_config',
//   uploaded: null
// };
//
// N.wire.emit('users.uploader:add', params).then(uploaded => uploaded.forEach(/*...*/));
//
// params:
//
// - files    - required
// - rpc      - required
// - config   - required, name of server method that returns config for uploader
// - uploaded - null, will be filled after upload - array of uploaded media
//
'use strict';


const _ = require('lodash');


let settings;
let $uploadDialog;
// Needed to terminate pending queue on abort
let aborted;
// Needed to check is confirmation dialog visible
let closeConfirmation;
let uploadedFiles;
let requests;
let image_blob_reduce;


// Check file extension
//
function checkFile(data) {
  let allowedFileExt = new RegExp('\.(' + settings.extensions.join('|') + ')$', 'i');
  let message;

  if (!allowedFileExt.test(data.file.name)) {
    message = t('err_invalid_ext', { file_name: data.file.name });
    N.wire.emit('notify', message);
    return new Error(message);
  }
}


// Resize image if needed
//
function resizeImage(data) {
  image_blob_reduce = image_blob_reduce || require('image-blob-reduce')();

  let ext = data.file.name.split('.').pop();
  let typeConfig = settings.types[ext] || {};

  // Check if file can be resized before upload
  if ([ 'bmp', 'jpg', 'jpeg', 'png' ].indexOf(ext) === -1 || !typeConfig.resize || !typeConfig.resize.orig) {
    return Promise.resolve(); // Skip resize
  }

  let resizeConfig = typeConfig.resize.orig;

  // If image size smaller than 'skip_size' - skip resizing
  if (data.file.size < resizeConfig.skip_size) {
    return Promise.resolve();
  }

  let $progressStatus = $('#' + data.uploaderFileId).find('.uploader-progress__status');

  $progressStatus.show(0);

  return image_blob_reduce.toBlob(data.file, { max: resizeConfig.width })
    .then(blob => {
      data.file = new File([ blob ], data.file.name, { type: blob.type });
      $progressStatus.hide(0);
    })
    .catch(err => {
      let message = t('err_bad_image', {
        file_name: data.file.name
      });

      N.wire.emit('notify', message);
      throw err; // re-throw
    });
}


function checkFileSize(data) {
  let ext = data.file.name.split('.').pop();
  let typeConfig = settings.types[ext] || {};
  let maxSize = typeConfig.max_size || settings.max_size;
  let message;

  if (data.file.size > maxSize) {
    message = t('err_max_size', {
      file_name: data.file.name,
      max_size_kb: Math.round(maxSize / 1024)
    });
    N.wire.emit('notify', message);

    return Promise.reject(new Error(message));
  }

  return Promise.resolve();
}


// Start uploading
//
function startUpload(data) {
  // If 'resizeImage' finished after user closed dialog
  if (aborted) return Promise.reject(new Error('aborted'));

  let $progressInfo = $('#' + data.uploaderFileId);

  let request = N.io.rpc(
    data.rpc[0],
    _.assign({}, data.rpc[1], { file: data.file }),
    {
      onProgress(e) {
        if (e.lengthComputable) {
          let progress = ((e.loaded * 100) / e.total).toFixed(2);

          $progressInfo.find('.progress-bar').width(progress + '%');
        }
      }
    }
  );

  requests.push(request);

  return request
    .then(res => {
      uploadedFiles.push(res.media);
      $progressInfo.find('.progress-bar').width('100%').addClass('bg-success');
    })
    .catch(err => {
      // Don't show error if user terminate file upload
      if (err.statusText === 'abort') {
        return;
      }

      $progressInfo.find('.uploader-progress__name').addClass('text-danger');
      $progressInfo.find('.progress-bar').addClass('bg-danger');

      // Client error
      if (err.code === N.io.CLIENT_ERROR) {
        N.wire.emit('notify', err.message);
      } else {
        N.wire.emit('notify', t('err_upload', { file_name: data.file.name }));
      }
    });
}

function abort() {
  if (requests) {
    requests.forEach(function (request) {
      request.cancel();
    });
  }

  aborted = true;
}

function confirmClose() {
  // Check `closeConfirmation` to avoid appear several confirmation dialogs
  if (closeConfirmation) {
    return Promise.resolve();
  }

  closeConfirmation = true;

  // Hide current dialog and show confirm dialog
  return new Promise((resolve, reject) => {
    $uploadDialog.on('hidden.bs.modal', () => {
      N.wire.emit('common.blocks.confirm', t('abort_confirm'))
        .then(() => {
          closeConfirmation = false;
          // If abort confirmed
          abort();
          resolve();
        })
        .catch(err => {
          // Return uploading dialog back if not finished yet
          if ($uploadDialog) {
            $uploadDialog
              .off('hidden.bs.modal')
              .modal('show');
          }
          reject(err);
        });
    }).modal('hide');
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
//
N.wire.before(module.apiPath + ':add', function load_config(data) {
  return N.io.rpc(data.config).then(function (uploaderSettings) {
    settings = uploaderSettings;
  });
});


// Load dependencies
//
N.wire.before(module.apiPath + ':add', function load_deps() {
  return N.loader.loadAssets('vendor.image-blob-reduce');
});


// Init upload dialog
//
N.wire.before(module.apiPath + ':add', function init_upload_dialog() {
  closeConfirmation = false;
  aborted = false;
  uploadedFiles = [];
  requests = [];

  $uploadDialog = $(N.runtime.render('users.uploader'));
  $('body').append($uploadDialog);

  return new Promise(resolve => {
    $uploadDialog
      .on('shown.bs.modal', function () {
        $uploadDialog.off('shown.bs.modal');
        resolve();
      })
      // Close dialog on click outside `.modal-content`
      .click(function (event) {
        if (event.target !== event.currentTarget) return;

        confirmClose();
      })
      .modal('show');
  });
});


// Resize files if needed, upload files
//
N.wire.on(module.apiPath + ':add', function add_files(data) {
  let uploadInfo = [];

  // Create unique id. Add initial progress info to dialog
  for (let i = 0; i < data.files.length; i++) {
    let info = {
      rpc: data.rpc,
      file: data.files[i],
      // create unique file id
      uploaderFileId: 'upload_' + Math.floor(Math.random() * 1e10)
    };

    uploadInfo.push(info);

    $(N.runtime.render(
      'users.uploader.progress',
      {
        file_name: info.file.name,
        element_id: info.uploaderFileId
      }
    )).appendTo('#uploader-files');
  }

  function finish() {
    data.uploaded = uploadedFiles.sort((a, b) => new Date(b.ts) - new Date(a.ts));

    uploadedFiles = null;
    requests = null;

    return new Promise(resolve => {
      // Uploader dialog already hidden by confirmation dialog
      if (aborted || closeConfirmation) {
        $uploadDialog.remove();
        $uploadDialog = null;

        resolve();
        return;
      }

      // Uploader dialog still visible, hide before remove
      $uploadDialog.on('hidden.bs.modal', function () {
        $uploadDialog.remove();
        $uploadDialog = null;

        resolve();
      }).modal('hide');
    });
  }

  function uploadFile(data) {
    if (uploadInfo.length === 0) return null;

    // Check if user termintae upload
    if (aborted) return Promise.reject(new Error('aborted'));

    let err = checkFile(data);

    if (err) return Promise.reject(err);

    return Promise.resolve()
      .then(() => resizeImage(data))
      .then(() => checkFileSize(data))
      .then(() => startUpload(data));
  }

  var res = Promise.resolve();

  // Build sequence (pica is already multithreaded)
  uploadInfo.forEach(data => {
    res = res.then(() => uploadFile(data).catch(() => {})); // ignore errors
  });

  return res.then(() => finish());
});


////////////////////////////////////////////////////////////////////////////////

// Close dialog handler
//
N.wire.on(module.apiPath + ':close', function close() {
  return confirmClose();
});


// Close dialog on sudden page exit (if user click back button in browser)
//
N.wire.on('navigate.exit', function teardown_page() {
  if (!$uploadDialog) return;

  abort();
});
