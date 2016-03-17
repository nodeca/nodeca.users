// File uploader with client side image resizing - used jQuery-File-Upload
//
// Ex.:
//
// Add files (from drop event)
//
// let params = {
//   files: event.dataTransfer.files,
//   url: '/url/to/upload/method',
//   config: 'users.uploader_config',
//   uploaded: null
// };
//
// N.wire.emit('users.uploader:add', params).then(uploaded => uploaded.forEach(/*...*/));
//
// params:
//
// - files    - required
// - url      - required
// - config   - required, name of server method that returns config for uploader
// - uploaded - null, will be filled after upload - array of uploaded media
//
'use strict';


const filter_jpeg = require('nodeca.users/lib/filter_jpeg');
const pica        = require('pica');


let settings;
let $uploadDialog;
// Needed to terminate pending queue on abort
let aborted;
// Needed to check is confirmation dialog visible
let closeConfirmation;
let uploadedFiles;
let requests;


// Concatenate multiple Uint8Arrays
//
function arrayConcat(list) {
  let size = 0;
  let pos = 0;

  for (let i = 0; i < list.length; i++) {
    size += list[i].length;
  }

  let result = new Uint8Array(size);

  for (let i = 0; i < list.length; i++) {
    result.set(list[i], pos);
    pos += list[i].length;
  }

  return result;
}


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
  return new Promise(resolve => {
    // Next tick
    setTimeout(() => {
      let ext = data.file.name.split('.').pop();
      let typeConfig = settings.types[ext] || {};

      // Check if file can be resized before upload
      if ([ 'bmp', 'jpg', 'jpeg', 'png' ].indexOf(ext) === -1 || !typeConfig.resize || !typeConfig.resize.orig) {
        resolve(); // Skip resize
        return;
      }

      let resizeConfig = typeConfig.resize.orig;

      // If image size smaller than 'skip_size' - skip resizing
      if (data.file.size < resizeConfig.skip_size) {
        resolve();
        return;
      }

      let $progressStatus = $('#' + data.uploaderFileId).find('.uploader-progress__status');
      let jpegHeader;
      let img = new Image();

      $progressStatus
        .text(t('progress.compressing'))
        .show(0);

      img.onload = () => {
        // To scale image we calculate new width and height, resize image by height and crop by width
        let scaledHeight, scaledWidth;

        if (resizeConfig.height && !resizeConfig.width) {
          // If only height defined - scale to fit height,
          // and crop by max_width
          scaledHeight = resizeConfig.height;

          let proportionalWidth = Math.floor(img.width * scaledHeight / img.height);

          scaledWidth = (!resizeConfig.max_width || resizeConfig.max_width > proportionalWidth) ?
                        proportionalWidth :
                        resizeConfig.max_width;

        } else if (!resizeConfig.height && resizeConfig.width) {
          // If only width defined - scale to fit width,
          // and crop by max_height
          scaledWidth = resizeConfig.width;

          let proportionalHeight = Math.floor(img.height * scaledWidth / img.width);

          scaledHeight = (!resizeConfig.max_height || resizeConfig.max_height > proportionalHeight) ?
                         proportionalHeight :
                         resizeConfig.max_height;

        } else {
          // If determine both width and height
          scaledWidth = resizeConfig.width;
          scaledHeight = resizeConfig.height;
        }

        /*eslint-disable no-undefined*/
        let quality = (ext === 'jpeg' || ext === 'jpg') ? resizeConfig.jpeg_quality : undefined;

        let width = Math.min(img.height * scaledWidth / scaledHeight, img.width);
        let cropX = (width - img.width) / 2;

        let alpha = ext === 'png';

        let source = document.createElement('canvas');
        let dest = document.createElement('canvas');

        source.width = width;
        source.height = img.height;

        dest.width = scaledWidth;
        dest.height = scaledHeight;

        source.getContext('2d').drawImage(img, cropX, 0, width, img.height);

        pica.resizeCanvas(source, dest, { alpha }, function () {

          dest.toBlob(function (blob) {
            let jpegBlob;
            let name = data.file.name;

            if (jpegHeader) {
              var fileReader = new FileReader();

              fileReader.onload = function () {
                let filter = filter_jpeg({ filter: true, removeICC: true, addMeta: jpegHeader });

                filter.push(new Uint8Array(this.result));
                filter.end();

                jpegBlob = new Blob(filter.output, { type: data.file.type });
                data.file = jpegBlob;
                data.file.name = name;
                $progressStatus.hide(0);
                resolve();
              };

              fileReader.readAsArrayBuffer(blob);
              return;
            }

            data.file = blob;
            data.file.name = name;
            $progressStatus.hide(0);
            resolve();
          }, data.file.type, quality);
        });
      };

      let reader = new FileReader();

      reader.onloadend = e => {
        // only keep comments and exif in header
        let filter = filter_jpeg({
          removeImage: true,
          filter:      true,
          removeICC:   true
        });

        filter.push(new Uint8Array(e.target.result));
        filter.end();

        jpegHeader = arrayConcat(filter.output);

        img.src = window.URL.createObjectURL(data.file);
      };

      reader.readAsArrayBuffer(data.file);
    }, 0);
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

  let formData = new FormData();

  formData.append('file', data.file);
  formData.append('csrf', N.runtime.token_csrf);

  let $progressInfo = $('#' + data.uploaderFileId);

  let jqXhr = $.ajax({
    url: data.url,
    type: 'POST',
    data: formData,
    dataType: 'json',
    processData: false,
    contentType: false,
    xhr() {
      let xhr = $.ajaxSettings.xhr();
      let progress;

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
  });

  requests.push(jqXhr);

  return Promise.resolve(jqXhr)
    .then(res => {
      uploadedFiles.push(res.media);
      $progressInfo.find('.progress-bar').addClass('progress-bar-success');
    })
    .catch(err => {
      // Don't show error if user terminate file upload
      if (err.statusText === 'abort') {
        return;
      }

      $progressInfo.find('.uploader-progress__name').addClass('text-danger');
      $progressInfo.find('.progress-bar').addClass('progress-bar-danger');

      // Client error
      if (err.status === N.io.CLIENT_ERROR) {
        N.wire.emit('notify', err.responseText);
      } else {
        N.wire.emit('notify', t('err_upload', { file_name: data.file.name }));
      }
    });
}

function abort() {
  if (requests) {
    requests.forEach(function (jqXhr) {
      jqXhr.abort();
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
      url: data.url,
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
