'use strict';


var pageParams;


N.wire.on('navigate.done:' + module.apiPath, function setup_page(data) {
  pageParams = data.params;

  // Init uploader
  N.wire.emit('users.uploader:init', {
    inputSelector: '#users-album__upload-files',
    uploadUrl: N.runtime.router.linkTo('users.media.upload', data.params),
    onDone: 'users.album:uploaded'
  });
});


N.wire.on('users.album:dragdrop', function (event) {
  var $dropZone = $('#users-album__upload');
  switch (event.type) {
    case 'dragover':
      // To activate drop zone when cursor above upload button
      $dropZone.addClass('active');
      break;
    case 'dragenter':
      $dropZone.addClass('active');
      break;
    case 'dragleave':
      $dropZone.removeClass('active');
      break;
    case 'drop':
      $dropZone.removeClass('active');

      if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) {
        N.wire.emit('users.uploader:add', event.dataTransfer.files);
      }
      break;
    default:
  }
});


var reloadAlbums = function () {
  N.io.rpc('users.media.list', pageParams, function (err, mediaList) {
    if (err) { return false; }

    var $list = $(N.runtime.render('users.album.media_list', mediaList));
    $('#users-medias-list').html($list);
  });
};


// listen successful media upload & reload media list
//
N.wire.on('users.album:uploaded', function update_list() {
  reloadAlbums();
});


// listen successful media delete
//
N.wire.on('users.album:deleted_media', function update_list() {
  reloadAlbums();
});
