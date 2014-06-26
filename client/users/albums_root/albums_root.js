'use strict';


var pageParams;


N.wire.on('navigate.done:' + module.apiPath, function setup_page(data) {
  pageParams = data.params;
  // Init uploader
  N.wire.emit('users.uploader:init', {
    inputSelector: 'body',
    onDone: 'users.albums_root:uploaded'
  });
});


var updateAlbumList = function () {
  N.io.rpc('users.albums_root.list', pageParams, function (err, albumsList) {
    if (err) { return false; }

    var $list = $(N.runtime.render('users.albums_root.list', albumsList));
    $('#users-albums-list').html($list);

    N.wire.emit('navigate.replace', {
      href: window.location.href,
      title: ''
    });
  });
};


// listen successeful album creation & reload albums list
//
N.wire.on('users.album.create:done', function update_list() {
  updateAlbumList();
});


// listen successeful photo upload & reload albums list
//
N.wire.on('users.albums_root:uploaded', function update_list() {
  updateAlbumList();
});


N.wire.on('users.albums_root.list:dragdrop', function (event) {
  var $dropZone, x0, y0, x1, y1, ex, ey, hid, id;

  switch (event.type) {
    case 'dragenter':
      $dropZone = $(event.target).closest('.user-album');
      $dropZone.addClass('active');
      break;
    case 'dragleave':
      $dropZone = $(event.target).closest('.user-album');
      x0 = $dropZone.offset().left;
      y0 = $dropZone.offset().top;
      x1 = x0 + $dropZone.outerWidth();
      y1 = y0 + $dropZone.outerHeight();
      ex = event.originalEvent.pageX;
      ey = event.originalEvent.pageY;

      if (ex > x1 || ex < x0 || ey > y1 || ey < y0) {
        $dropZone.removeClass('active');
      }
      break;
    case 'drop':
      $dropZone = $(event.target).closest('.user-album');
      $dropZone.removeClass('active');

      id = $dropZone.data('albumId');
      hid = $dropZone.data('userHid');

      if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) {
        N.wire.emit('users.uploader:add', {
          files: event.dataTransfer.files,
          url: N.runtime.router.linkTo('users.media.upload', { user_hid: hid, album_id: id })
        });
      }
      break;
    default:
  }
});
