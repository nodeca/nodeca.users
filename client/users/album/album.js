'use strict';


var pageParams;
var $dropZone;


N.wire.on('navigate.done:' + module.apiPath, function setup_page(data) {
  $dropZone = $('#users-album__upload');
  pageParams = data.params;

  // Init uploader
  N.wire.emit('users.uploader:init', {
    inputSelector: '#users-album__upload-files',
    uploadUrl: N.runtime.router.linkTo('users.media.upload', data.params),
    onDone: 'users.album:uploaded'
  });
});


N.wire.on('users.album:dragdrop', function (event) {
  switch (event.type) {
    case 'dragenter':
      $dropZone.addClass('active');
      break;
    case 'dragleave':
      var x0 = $dropZone.offset().left;
      var y0 = $dropZone.offset().top;
      var x1 = x0 + $dropZone.outerWidth();
      var y1 = y0 + $dropZone.outerHeight();
      var ex = event.originalEvent.pageX;
      var ey = event.originalEvent.pageY;

      if(ex > x1 || ex < x0 || ey > y1 || ey < y0) {
        $dropZone.removeClass('active');
      }
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
